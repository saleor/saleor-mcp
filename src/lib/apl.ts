import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import type { APL } from "@saleor/app-sdk/APL";
import { DynamoAPL } from "@saleor/app-sdk/APL/dynamodb";
import { FileAPL } from "@saleor/app-sdk/APL/file";
import { Table } from "dynamodb-toolbox";

function createDynamoApl(): APL {
  const tableName = process.env.APL_DYNAMODB_TABLE;
  if (!tableName) {
    throw new Error("APL_DYNAMODB_TABLE is required when APL_PROVIDER=dynamodb.");
  }

  const documentClient = DynamoDBDocumentClient.from(
    new DynamoDBClient({ region: process.env.AWS_REGION }),
    { marshallOptions: { removeUndefinedValues: true } },
  );
  const table = new Table({
    documentClient,
    name: tableName,
    partitionKey: { name: "PK", type: "string" },
    sortKey: { name: "SK", type: "string" },
  });
  return DynamoAPL.create({ table });
}

function createApl(): APL {
  const provider =
    process.env.APL_PROVIDER ?? (process.env.NODE_ENV === "production" ? "dynamodb" : "file");
  if (provider === "dynamodb") return createDynamoApl();
  if (provider === "file") {
    if (process.env.NODE_ENV === "production") {
      throw new Error("FileAPL is not safe in production. Configure APL_PROVIDER=dynamodb.");
    }
    return new FileAPL({ fileName: process.env.APL_FILE_PATH ?? ".saleor-app-auth.json" });
  }
  throw new Error(`Unsupported APL_PROVIDER: ${provider}`);
}

export const apl = createApl();
