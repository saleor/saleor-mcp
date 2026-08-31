import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import type { APL } from "@saleor/app-sdk/APL";
import { DynamoAPL } from "@saleor/app-sdk/APL/dynamodb";
import { FileAPL } from "@saleor/app-sdk/APL/file";
import { Table } from "dynamodb-toolbox";

class UnconfiguredApl implements APL {
  private error(): never {
    throw new Error(
      "APL_PROVIDER must select a persistent APL in production. Supported values: dynamodb.",
    );
  }

  async get() {
    return this.error();
  }

  async set() {
    return this.error();
  }

  async delete() {
    return this.error();
  }

  async getAll() {
    return this.error();
  }

  async isConfigured() {
    return { configured: false as const, error: new Error("Persistent APL is not configured.") };
  }
}

type AplEnvironment = Record<string, string | undefined>;

export function createApl(
  env: AplEnvironment = process.env,
  documentClient?: DynamoDBDocumentClient,
): APL {
  const provider = env.APL_PROVIDER ?? (env.NODE_ENV === "production" ? "" : "file");

  if (provider === "file") {
    if (env.NODE_ENV === "production") {
      throw new Error(
        "FileAPL is for local development only. Configure a persistent APL provider.",
      );
    }
    return new FileAPL({ fileName: ".saleor-app-auth.json" });
  }

  if (provider === "dynamodb") {
    const tableName = env.APL_DYNAMODB_TABLE;
    if (!tableName) throw new Error("APL_DYNAMODB_TABLE is required for the dynamodb APL.");
    const table = new Table({
      documentClient: documentClient ?? DynamoDBDocumentClient.from(new DynamoDBClient({})),
      name: tableName,
      partitionKey: { name: "PK", type: "string" },
      sortKey: { name: "SK", type: "string" },
    });
    return DynamoAPL.create({ table });
  }

  if (!provider && env.NODE_ENV === "production") return new UnconfiguredApl();

  throw new Error("APL_PROVIDER must be 'file' or 'dynamodb'.");
}

const globalForApl = globalThis as typeof globalThis & { saleorMcpApl?: APL };

export const apl = globalForApl.saleorMcpApl ?? createApl();

if (process.env.NODE_ENV !== "production") globalForApl.saleorMcpApl = apl;
