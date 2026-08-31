import type { AuthData } from "@saleor/app-sdk/APL";
import { jwtVerify, SignJWT } from "jose";

const ISSUER = "saleor-mcp";
const AUDIENCE = "saleor-mcp-client";

export class InstallationCredentialConfigurationError extends Error {}

function signingKey(): Uint8Array {
  const secret = process.env.MCP_CREDENTIAL_SECRET;
  if (!secret || secret.length < 32) {
    throw new InstallationCredentialConfigurationError(
      "MCP_CREDENTIAL_SECRET must contain at least 32 characters.",
    );
  }
  return new TextEncoder().encode(secret);
}

export async function issueInstallationCredential(authData: AuthData): Promise<string> {
  return new SignJWT({ saleorApiUrl: authData.saleorApiUrl, appId: authData.appId })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setSubject(authData.appId)
    .setIssuedAt()
    .sign(signingKey());
}

export async function verifyInstallationCredential(
  credential: string,
): Promise<{ saleorApiUrl: string; appId: string }> {
  const { payload } = await jwtVerify(credential, signingKey(), {
    issuer: ISSUER,
    audience: AUDIENCE,
    algorithms: ["HS256"],
  });

  if (typeof payload.saleorApiUrl !== "string" || typeof payload.appId !== "string") {
    throw new Error("The installation credential is missing its installation identity.");
  }

  return { saleorApiUrl: payload.saleorApiUrl, appId: payload.appId };
}
