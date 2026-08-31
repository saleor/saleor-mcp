import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  issueInstallationCredential,
  verifyInstallationCredential,
} from "./installation-credential";

describe("installation credentials", () => {
  beforeEach(() =>
    vi.stubEnv("MCP_CREDENTIAL_SECRET", "a-secret-with-at-least-thirty-two-characters"),
  );
  afterEach(() => vi.unstubAllEnvs());

  it("round-trips only the installation identity", async () => {
    const credential = await issueInstallationCredential({
      appId: "app-1",
      saleorApiUrl: "https://shop.saleor.cloud/graphql/",
      token: "server-only-app-token",
    });
    await expect(verifyInstallationCredential(credential)).resolves.toEqual({
      appId: "app-1",
      saleorApiUrl: "https://shop.saleor.cloud/graphql/",
    });
    expect(credential).not.toContain("server-only-app-token");
  });

  it("rejects credentials signed by another deployment", async () => {
    const credential = await issueInstallationCredential({
      appId: "app-1",
      saleorApiUrl: "https://shop.saleor.cloud/graphql/",
      token: "token",
    });
    vi.stubEnv("MCP_CREDENTIAL_SECRET", "a-different-secret-with-thirty-two-characters");
    await expect(verifyInstallationCredential(credential)).rejects.toThrow();
  });

  it("requires a strong deployment secret", async () => {
    vi.stubEnv("MCP_CREDENTIAL_SECRET", "short");
    await expect(
      issueInstallationCredential({
        appId: "app",
        saleorApiUrl: "https://example.com/graphql/",
        token: "x",
      }),
    ).rejects.toThrow("at least 32");
  });
});
