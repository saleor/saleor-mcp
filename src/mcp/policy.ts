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
  operationName?: string;
  selectedOperationType?: OperationTypeNode;
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

function parseDocument(query: string) {
  let document;
  try {
    document = parse(query);
  } catch (error) {
    throw new Error(
      `Invalid GraphQL syntax: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  return document;
}

export function analyzeDocument(query: string): DocumentAnalysis {
  const document = parseDocument(query);

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

export function analyzeSelectedOperation(
  query: string,
  operationName?: string | null,
): DocumentAnalysis {
  const document = parseDocument(query);
  const operations = document.definitions.filter(
    (definition): definition is OperationDefinitionNode =>
      definition.kind === Kind.OPERATION_DEFINITION,
  );
  if (operations.length === 0) {
    throw new Error(
      "The document contains no executable operation. Provide a query or mutation operation.",
    );
  }
  if (!operationName && operations.length > 1) {
    throw new Error(
      "The document defines multiple operations. Provide 'operation_name' to select exactly one.",
    );
  }

  const operation = operationName
    ? operations.find((candidate) => candidate.name?.value === operationName)
    : operations[0];
  if (!operation)
    throw new Error(`The operation '${operationName}' does not exist in the document.`);

  const fragments = new Map(
    document.definitions
      .filter(
        (definition): definition is FragmentDefinitionNode =>
          definition.kind === Kind.FRAGMENT_DEFINITION,
      )
      .map((fragment) => [fragment.name.value, fragment]),
  );
  const fields = rootFieldNames(operation, fragments);
  return {
    operationTypes: new Set([operation.operation]),
    mutationFields: operation.operation === OperationTypeNode.MUTATION ? fields : [],
    queryFields: operation.operation === OperationTypeNode.QUERY ? fields : [],
    operationCount: operations.length,
    operationName: operation.name?.value,
    selectedOperationType: operation.operation,
  };
}

export function assertQueryAllowed(query: string, operationName?: string | null): DocumentAnalysis {
  const analysis = analyzeSelectedOperation(query, operationName);
  if (analysis.selectedOperationType === OperationTypeNode.SUBSCRIPTION) {
    throw new Error("Subscriptions are not supported by this server.");
  }
  if (analysis.selectedOperationType === OperationTypeNode.MUTATION) {
    throw new Error(
      "The selected operation is a mutation. Use the 'run_mutation' tool for operations that modify data.",
    );
  }
  return analysis;
}

export function assertMutationAllowed(
  query: string,
  policy: PolicyConfig,
  operationName?: string | null,
): DocumentAnalysis {
  const analysis = analyzeSelectedOperation(query, operationName);
  if (analysis.selectedOperationType === OperationTypeNode.SUBSCRIPTION) {
    throw new Error("Subscriptions are not supported by this server.");
  }
  if (analysis.selectedOperationType !== OperationTypeNode.MUTATION) {
    throw new Error(
      "The selected operation is not a mutation. Use the 'run_query' tool for read-only operations.",
    );
  }
  if (policy.mode === "read_only") {
    throw new Error(
      "This Saleor MCP installation is in read-only mode, so mutations are disabled. An administrator can enable reviewed writes in the app's permission settings.",
    );
  }

  const notAllowed = [
    ...new Set(analysis.mutationFields.filter((name) => !policy.allowedMutations.has(name))),
  ].sort();
  if (policy.mode === "read_write" && notAllowed.length > 0) {
    throw new Error(
      `The following mutation(s) are not in this installation's allowlist: ${notAllowed.join(", ")}. An administrator can review and add them in the Saleor MCP app settings.`,
    );
  }

  return analysis;
}
