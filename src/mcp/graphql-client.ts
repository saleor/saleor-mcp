import type { AuthData } from "@saleor/app-sdk/APL";

export class SaleorGraphQLError extends Error {}

export type GraphQLResponse = {
  data?: Record<string, unknown> | null;
  errors?: Array<Record<string, unknown>>;
  [key: string]: unknown;
};

export async function executeGraphql(
  authData: AuthData,
  query: string,
  variables?: Record<string, unknown> | null,
  operationName?: string | null,
): Promise<GraphQLResponse> {
  const body: Record<string, unknown> = { query, variables: variables ?? {} };
  if (operationName) body.operationName = operationName;

  let response: Response;
  try {
    response = await fetch(authData.saleorApiUrl, {
      method: "POST",
      headers: {
        "Authorization-Bearer": authData.token,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(30_000),
    });
  } catch (error) {
    throw new SaleorGraphQLError(
      `Failed to reach Saleor API at ${authData.saleorApiUrl}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  const responseText = await response.text();
  if (!response.ok) {
    throw new SaleorGraphQLError(
      `Saleor API returned HTTP ${response.status}: ${responseText.slice(0, 500)}`,
    );
  }

  try {
    return JSON.parse(responseText) as GraphQLResponse;
  } catch {
    throw new SaleorGraphQLError(
      `Saleor API returned a non-JSON response: ${responseText.slice(0, 500)}`,
    );
  }
}
