import {
  Kind,
  OperationTypeNode,
  parse,
  type FragmentDefinitionNode,
  type OperationDefinitionNode,
  type SelectionSetNode,
} from "graphql";

import type { PolicyConfig } from "./config";

const MAX_DOCUMENT_CHARACTERS = 100_000;
const MAX_DOCUMENT_TOKENS = 10_000;
const MAX_ROOT_FIELDS_PER_OPERATION = 500;
const MAX_ROOT_SELECTION_DEPTH = 64;

export type DocumentAnalysis = {
  operationTypes: Set<OperationTypeNode>;
  mutationFields: string[];
  queryFields: string[];
  operationCount: number;
};

function rootFieldNames(
  operation: OperationDefinitionNode,
  fragments: Map<string, FragmentDefinitionNode>,
): string[] {
  const names = new Set<string>();
  const visitedFragments = new Set<string>();
  let rootFieldCount = 0;

  const walk = (selectionSet: SelectionSetNode, depth: number) => {
    if (depth > MAX_ROOT_SELECTION_DEPTH) {
      throw new Error(
        `GraphQL operation exceeds the maximum root selection depth of ${MAX_ROOT_SELECTION_DEPTH}.`,
      );
    }

    for (const selection of selectionSet.selections) {
      if (selection.kind === Kind.FIELD) {
        rootFieldCount += 1;
        if (rootFieldCount > MAX_ROOT_FIELDS_PER_OPERATION) {
          throw new Error(
            `GraphQL operation contains more than ${MAX_ROOT_FIELDS_PER_OPERATION} root fields.`,
          );
        }
        names.add(selection.name.value);
      } else if (selection.kind === Kind.INLINE_FRAGMENT) {
        walk(selection.selectionSet, depth + 1);
      } else if (selection.kind === Kind.FRAGMENT_SPREAD) {
        const fragmentName = selection.name.value;
        if (visitedFragments.has(fragmentName)) continue;
        visitedFragments.add(fragmentName);

        const fragment = fragments.get(fragmentName);
        if (!fragment) throw new Error(`Unknown GraphQL fragment '${fragmentName}'.`);
        walk(fragment.selectionSet, depth + 1);
      }
    }
  };

  walk(operation.selectionSet, 0);
  return [...names];
}

export function analyzeDocument(query: string): DocumentAnalysis {
  if (query.length > MAX_DOCUMENT_CHARACTERS) {
    throw new Error(
      `GraphQL document exceeds the maximum size of ${MAX_DOCUMENT_CHARACTERS} characters.`,
    );
  }

  let document;
  try {
    document = parse(query, { maxTokens: MAX_DOCUMENT_TOKENS });
  } catch (error) {
    throw new Error(
      `Invalid GraphQL syntax: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  const fragments = new Map<string, FragmentDefinitionNode>();
  for (const definition of document.definitions) {
    if (definition.kind !== Kind.FRAGMENT_DEFINITION) continue;
    const fragmentName = definition.name.value;
    if (fragments.has(fragmentName)) {
      throw new Error(`Duplicate GraphQL fragment '${fragmentName}'.`);
    }
    fragments.set(fragmentName, definition);
  }
  const analysis: DocumentAnalysis = {
    operationTypes: new Set(),
    mutationFields: [],
    queryFields: [],
    operationCount: 0,
  };

  for (const definition of document.definitions) {
    if (definition.kind !== Kind.OPERATION_DEFINITION) continue;
    analysis.operationCount += 1;
    analysis.operationTypes.add(definition.operation);
    const names = rootFieldNames(definition, fragments);
    if (definition.operation === OperationTypeNode.MUTATION) analysis.mutationFields.push(...names);
    if (definition.operation === OperationTypeNode.QUERY) analysis.queryFields.push(...names);
  }

  if (analysis.operationCount === 0) {
    throw new Error(
      "The document contains no executable operation. Provide a query or mutation operation.",
    );
  }

  return analysis;
}

export function assertQueryAllowed(query: string): DocumentAnalysis {
  const analysis = analyzeDocument(query);
  if (analysis.operationTypes.has(OperationTypeNode.SUBSCRIPTION)) {
    throw new Error("Subscriptions are not supported by this server.");
  }
  if (analysis.operationTypes.has(OperationTypeNode.MUTATION)) {
    throw new Error(
      "This document contains a mutation. Use the 'run_mutation' tool for operations that modify data.",
    );
  }
  return analysis;
}

export function assertMutationAllowed(query: string, policy: PolicyConfig): DocumentAnalysis {
  const analysis = analyzeDocument(query);
  if (analysis.operationTypes.has(OperationTypeNode.SUBSCRIPTION)) {
    throw new Error("Subscriptions are not supported by this server.");
  }
  if (!analysis.operationTypes.has(OperationTypeNode.MUTATION)) {
    throw new Error(
      "This document contains no mutation. Use the 'run_query' tool for read-only operations.",
    );
  }
  if (analysis.operationTypes.has(OperationTypeNode.QUERY)) {
    throw new Error(
      "Mixing query and mutation operations in one document is not allowed. Submit the mutation on its own.",
    );
  }
  if (policy.mode === "read_only") {
    throw new Error(
      "The server is running in read_only mode, so mutations are disabled. Set SALEOR_MCP_MODE=read_write and allowlist specific mutations to enable writes.",
    );
  }

  const notAllowed = [
    ...new Set(analysis.mutationFields.filter((name) => !policy.allowedMutations.has(name))),
  ].sort();
  if (notAllowed.length > 0) {
    throw new Error(
      `The following mutation(s) are not in the deployment allowlist: ${notAllowed.join(", ")}. Add them to SALEOR_MCP_ALLOWED_MUTATIONS after reviewing their effects.`,
    );
  }

  return analysis;
}
