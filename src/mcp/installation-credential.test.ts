import { decodeProtectedHeader } from "jose";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { otherCredentialPublicKey, stubCredentialKeys } from "@/tests/credential-keys";

import {
  issueInstallationCredential,
  verifyInstallationCredential,
} from "./installation-credential";

describe("installation credentials", () => {
  beforeEach(stubCredentialKeys);
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
    expect(decodeProtectedHeader(credential).alg).toBe("RS512");
  });

  it("rejects credentials signed by another deployment", async () => {
    const credential = await issueInstallationCredential({
      appId: "app-1",
      saleorApiUrl: "https://shop.saleor.cloud/graphql/",
      token: "token",
    });
    vi.stubEnv("MCP_CREDENTIAL_PUBLIC_KEY", otherCredentialPublicKey);
    await expect(verifyInstallationCredential(credential)).rejects.toThrow();
  });

  it("requires a valid RSA private key", async () => {
    vi.stubEnv("MCP_CREDENTIAL_PRIVATE_KEY", "not-a-private-key");
    await expect(
      issueInstallationCredential({
        appId: "app",
        saleorApiUrl: "https://example.com/graphql/",
        token: "x",
      }),
    ).rejects.toThrow("valid PKCS8 RSA private key");
  });
});
