import { readFile } from "node:fs/promises";
import path from "node:path";

import type { AuthData } from "@saleor/app-sdk/APL";
import {
  buildClientSchema,
  buildSchema,
  getIntrospectionQuery,
  GraphQLEnumType,
  GraphQLInputObjectType,
  GraphQLInterfaceType,
  GraphQLObjectType,
  GraphQLScalarType,
  type GraphQLSchema,
  GraphQLUnionType,
  isInterfaceType,
  isObjectType,
} from "graphql";

import { executeGraphql, SaleorGraphQLError } from "./graphql-client";

const MAX_RESULTS = 50;
const SCHEMA_CACHE_MAX_SIZE = 128;
const schemaCache = new Map<string, GraphQLSchema>();
let bundledSchema: GraphQLSchema | undefined;

export async function getSchema(authData: AuthData): Promise<GraphQLSchema> {
  const cached = schemaCache.get(authData.saleorApiUrl);
  if (cached) {
    schemaCache.delete(authData.saleorApiUrl);
    schemaCache.set(authData.saleorApiUrl, cached);
    return cached;
  }

  try {
    const response = await executeGraphql(authData, getIntrospectionQuery({ descriptions: true }));
    if (response.data) {
      const schema = buildClientSchema(response.data as never);
      schemaCache.set(authData.saleorApiUrl, schema);
      if (schemaCache.size > SCHEMA_CACHE_MAX_SIZE) {
        const oldest = schemaCache.keys().next().value;
        if (oldest) schemaCache.delete(oldest);
      }
      return schema;
    }
  } catch (error) {
    if (!(error instanceof SaleorGraphQLError)) throw error;
    console.warn("Live Saleor introspection failed; using the bundled schema.", error.message);
  }

  if (!bundledSchema) {
    const schemaOverride = process.env.SALEOR_SCHEMA_PATH;
    const schemaSdl = schemaOverride
      ? await readFile(/* turbopackIgnore: true */ schemaOverride, "utf8")
      : await readFile(path.join(process.cwd(), "schema.graphql"), "utf8");
    bundledSchema = buildSchema(schemaSdl, { assumeValid: true });
  }
  return bundledSchema;
}

function typeKind(type: unknown): string {
  if (type instanceof GraphQLObjectType) return "OBJECT";
  if (type instanceof GraphQLInputObjectType) return "INPUT_OBJECT";
  if (type instanceof GraphQLInterfaceType) return "INTERFACE";
  if (type instanceof GraphQLUnionType) return "UNION";
  if (type instanceof GraphQLEnumType) return "ENUM";
  if (type instanceof GraphQLScalarType) return "SCALAR";
  return "UNKNOWN";
}

function describeArgument(
  name: string,
  argument: { type: unknown; description?: string | null; defaultValue?: unknown },
) {
  return {
    name,
    type: String(argument.type),
    description: argument.description ?? null,
    default: argument.defaultValue ?? null,
  };
}

function describeField(
  name: string,
  field: {
    type: unknown;
    description?: string | null;
    args: readonly {
      name: string;
      type: unknown;
      description?: string | null;
      defaultValue?: unknown;
    }[];
    deprecationReason?: string | null;
  },
) {
  return {
    name,
    type: String(field.type),
    description: field.description ?? null,
    args: field.args.map((argument) => describeArgument(argument.name, argument)),
    deprecationReason: field.deprecationReason ?? null,
  };
}

export function describeType(schema: GraphQLSchema, name: string): Record<string, unknown> {
  const type = schema.getType(name);
  if (!type) return { error: `Type '${name}' not found in the schema.` };
  const result: Record<string, unknown> = {
    name,
    kind: typeKind(type),
    description: type.description ?? null,
  };

  if (isObjectType(type) || isInterfaceType(type)) {
    result.fields = Object.entries(type.getFields()).map(([fieldName, field]) =>
      describeField(fieldName, field),
    );
    if (isObjectType(type)) result.interfaces = type.getInterfaces().map((item) => item.name);
  } else if (type instanceof GraphQLInputObjectType) {
    result.inputFields = Object.entries(type.getFields()).map(([fieldName, field]) => ({
      name: fieldName,
      type: String(field.type),
      description: field.description ?? null,
      default: field.defaultValue ?? null,
    }));
  } else if (type instanceof GraphQLEnumType) {
    result.enumValues = type.getValues().map((value) => ({
      name: value.name,
      description: value.description ?? null,
      deprecationReason: value.deprecationReason ?? null,
    }));
  } else if (type instanceof GraphQLUnionType) {
    result.possibleTypes = type.getTypes().map((item) => item.name);
  }
  return result;
}

export function searchSchema(schema: GraphQLSchema, keyword: string, limit = MAX_RESULTS) {
  const needle = keyword.toLowerCase();
  const types: Array<{ name: string; kind: string }> = [];
  const fields: Array<{ type: string; field: string }> = [];

  for (const [typeName, type] of Object.entries(schema.getTypeMap())) {
    if (typeName.startsWith("__")) continue;
    if (typeName.toLowerCase().includes(needle))
      types.push({ name: typeName, kind: typeKind(type) });
    if (isObjectType(type) || isInterfaceType(type) || type instanceof GraphQLInputObjectType) {
      for (const fieldName of Object.keys(type.getFields())) {
        if (fieldName.toLowerCase().includes(needle))
          fields.push({ type: typeName, field: fieldName });
      }
    }
  }

  return {
    keyword,
    types: types.slice(0, limit),
    fields: fields.slice(0, limit),
    truncated: types.length > limit || fields.length > limit,
  };
}

export function listOperations(
  schema: GraphQLSchema,
  kind: "query" | "mutation",
  search?: string | null,
  limit = MAX_RESULTS,
) {
  const root = kind === "query" ? schema.getQueryType() : schema.getMutationType();
  if (!root) return { kind, operations: [], totalCount: 0 };
  const needle = search?.toLowerCase();
  const operations = Object.entries(root.getFields())
    .filter(([name]) => !needle || name.toLowerCase().includes(needle))
    .map(([name, field]) => ({
      name,
      type: String(field.type),
      description: (field.description ?? "").split("\n")[0],
    }));
  return {
    kind,
    operations: operations.slice(0, limit),
    totalCount: operations.length,
    truncated: operations.length > limit,
  };
}

export function describeOperation(
  schema: GraphQLSchema,
  name: string,
  kind?: "query" | "mutation" | null,
) {
  const candidates = [
    ...(kind !== "mutation" ? ([["query", schema.getQueryType()]] as const) : []),
    ...(kind !== "query" ? ([["mutation", schema.getMutationType()]] as const) : []),
  ];
  for (const [operationKind, root] of candidates) {
    const field = root?.getFields()[name];
    if (field) return { kind: operationKind, ...describeField(name, field) };
  }
  return { error: `Operation '${name}' not found as a query or mutation.` };
}

export function clearSchemaCachesForTests() {
  schemaCache.clear();
  bundledSchema = undefined;
}
