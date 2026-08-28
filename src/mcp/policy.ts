import {
  Kind,
  OperationTypeNode,
  parse,
  type FragmentDefinitionNode,
  type OperationDefinitionNode,
  type SelectionSetNode,
} from "graphql";

import type { PolicyConfig } from "./config";

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
  const names: string[] = [];

  const walk = (selectionSet: SelectionSetNode, seen: ReadonlySet<string>) => {
    for (const selection of selectionSet.selections) {
      if (selection.kind === Kind.FIELD) {
        names.push(selection.name.value);
      } else if (selection.kind === Kind.INLINE_FRAGMENT) {
        walk(selection.selectionSet, seen);
      } else if (selection.kind === Kind.FRAGMENT_SPREAD && !seen.has(selection.name.value)) {
        const fragment = fragments.get(selection.name.value);
        if (fragment) walk(fragment.selectionSet, new Set([...seen, selection.name.value]));
      }
    }
  };

  walk(operation.selectionSet, new Set());
  return names;
}

export function analyzeDocument(query: string): DocumentAnalysis {
  let document;
  try {
    document = parse(query);
  } catch (error) {
    throw new Error(
      `Invalid GraphQL syntax: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  const fragments = new Map(
    document.definitions
      .filter(
        (definition): definition is FragmentDefinitionNode =>
          definition.kind === Kind.FRAGMENT_DEFINITION,
      )
      .map((fragment) => [fragment.name.value, fragment]),
  );
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
      "The server is running in read_only mode, so mutations are disabled. Set SALEOR_MCP_MODE=read_write (or unrestricted) to enable writes.",
    );
  }

  const blocked = [
    ...new Set(analysis.mutationFields.filter((name) => policy.effectiveBlocklist.has(name))),
  ].sort();
  if (blocked.length > 0) {
    throw new Error(
      `The following mutation(s) are blocked by the current safety policy: ${blocked.join(", ")}. These are considered high-risk (identity, access control, apps or instance settings). To allow them, add them to SALEOR_MCP_ALLOWED_MUTATIONS or set SALEOR_MCP_MODE=unrestricted.`,
    );
  }

  return analysis;
}
