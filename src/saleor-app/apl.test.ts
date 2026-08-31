import { DynamoAPL } from "@saleor/app-sdk/APL/dynamodb";
import { FileAPL } from "@saleor/app-sdk/APL/file";
import { describe, expect, it } from "vitest";

import { createApl } from "./apl";

describe("APL selection", () => {
  it("uses FileAPL only outside production", () => {
    expect(createApl({ NODE_ENV: "test" })).toBeInstanceOf(FileAPL);
    expect(() => createApl({ NODE_ENV: "production", APL_PROVIDER: "file" })).toThrow(
      "local development only",
    );
  });

  it("reports an unconfigured production APL without crashing module loading", async () => {
    const apl = createApl({ NODE_ENV: "production" });
    await expect(apl.isConfigured?.()).resolves.toMatchObject({ configured: false });
    await expect(apl.get("https://shop.example/graphql/")).rejects.toThrow("persistent APL");
  });

  it("requires a table and creates the Saleor SDK DynamoAPL", () => {
    expect(() => createApl({ APL_PROVIDER: "dynamodb" })).toThrow("APL_DYNAMODB_TABLE");
    expect(
      createApl({ APL_PROVIDER: "dynamodb", APL_DYNAMODB_TABLE: "saleor-app" }),
    ).toBeInstanceOf(DynamoAPL);
  });

  it("rejects unsupported providers", () => {
    expect(() => createApl({ APL_PROVIDER: "memory" })).toThrow(
      "APL_PROVIDER must be 'file' or 'dynamodb'",
    );
  });
});
