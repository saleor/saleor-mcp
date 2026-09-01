import { decodeJwt, decodeProtectedHeader } from "jose";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { otherCredentialPublicKey, stubCredentialKeys } from "@/tests/credential-keys";

import {
  ExpiredInstallationCredentialError,
  issueInstallationCredential,
  verifyInstallationCredential,
} from "./installation-credential";

describe("installation credentials", () => {
  beforeEach(stubCredentialKeys);
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
  });

  it("round-trips only the installation identity", async () => {
    const authData = {
      appId: "app-1",
      saleorApiUrl: "https://shop.saleor.cloud/graphql/",
      token: "server-only-app-token",
    };
    const credential = await issueInstallationCredential(authData);
    await expect(verifyInstallationCredential(credential, async () => authData)).resolves.toEqual(
      authData,
    );
    expect(credential).not.toContain("server-only-app-token");
    expect(decodeProtectedHeader(credential).alg).toBe("RS512");
    const claims = decodeJwt(credential);
    expect(claims.exp! - claims.iat!).toBe(90 * 24 * 60 * 60);
  });

  it("rejects credentials after 90 days with a clear renewal message", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
    const authData = {
      appId: "app-1",
      saleorApiUrl: "https://shop.saleor.cloud/graphql/",
      token: "server-only-app-token",
    };
    const credential = await issueInstallationCredential(authData);

    vi.advanceTimersByTime(90 * 24 * 60 * 60 * 1_000 + 1_000);

    await expect(
      verifyInstallationCredential(credential, async () => authData),
    ).rejects.toThrow(ExpiredInstallationCredentialError);
    await expect(
      verifyInstallationCredential(credential, async () => authData),
    ).rejects.toThrow(
      "MCP installation credential expired. Open the Saleor MCP app in Dashboard and copy a new configuration.",
    );
  });

  it("rejects credentials signed by another deployment", async () => {
    const credential = await issueInstallationCredential({
      appId: "app-1",
      saleorApiUrl: "https://shop.saleor.cloud/graphql/",
      token: "token",
    });
    vi.stubEnv("MCP_CREDENTIAL_PUBLIC_KEY", otherCredentialPublicKey);
    await expect(verifyInstallationCredential(credential, async () => undefined)).rejects.toThrow();
  });

  it("rejects credentials after the installation token changes", async () => {
    const credential = await issueInstallationCredential({
      appId: "app-1",
      saleorApiUrl: "https://shop.saleor.cloud/graphql/",
      token: "old-token",
    });

    await expect(
      verifyInstallationCredential(credential, async () => ({
        appId: "app-1",
        saleorApiUrl: "https://shop.saleor.cloud/graphql/",
        token: "replacement-token",
      })),
    ).rejects.toThrow("no longer active");
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
