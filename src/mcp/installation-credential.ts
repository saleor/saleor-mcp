import type { AuthData } from "@saleor/app-sdk/APL";
import { importPKCS8, importSPKI, jwtVerify, SignJWT } from "jose";

const ISSUER = "saleor-mcp";
const AUDIENCE = "saleor-mcp-client";

export class InstallationCredentialConfigurationError extends Error {}

function readKey(name: "MCP_CREDENTIAL_PRIVATE_KEY" | "MCP_CREDENTIAL_PUBLIC_KEY"): string {
  const key = process.env[name]?.replace(/\\n/g, "\n").trim();
  if (!key) {
    throw new InstallationCredentialConfigurationError(
      `${name} must contain a PEM-encoded RSA key.`,
    );
  }
  return key;
}

async function signingKey() {
  try {
    return await importPKCS8(readKey("MCP_CREDENTIAL_PRIVATE_KEY"), "RS512");
  } catch (error) {
    if (error instanceof InstallationCredentialConfigurationError) throw error;
    throw new InstallationCredentialConfigurationError(
      "MCP_CREDENTIAL_PRIVATE_KEY must contain a valid PKCS8 RSA private key.",
      { cause: error },
    );
  }
}

async function verificationKey() {
  try {
    return await importSPKI(readKey("MCP_CREDENTIAL_PUBLIC_KEY"), "RS512");
  } catch (error) {
    if (error instanceof InstallationCredentialConfigurationError) throw error;
    throw new InstallationCredentialConfigurationError(
      "MCP_CREDENTIAL_PUBLIC_KEY must contain a valid SPKI RSA public key.",
      { cause: error },
    );
  }
}

export async function issueInstallationCredential(authData: AuthData): Promise<string> {
  return new SignJWT({ saleorApiUrl: authData.saleorApiUrl, appId: authData.appId })
    .setProtectedHeader({ alg: "RS512", typ: "JWT" })
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setSubject(authData.appId)
    .setIssuedAt()
    .sign(await signingKey());
}

export async function verifyInstallationCredential(
  credential: string,
): Promise<{ saleorApiUrl: string; appId: string }> {
  const { payload } = await jwtVerify(credential, await verificationKey(), {
    issuer: ISSUER,
    audience: AUDIENCE,
    algorithms: ["RS512"],
  });

  if (typeof payload.saleorApiUrl !== "string" || typeof payload.appId !== "string") {
    throw new Error("The installation credential is missing its installation identity.");
  }

  return { saleorApiUrl: payload.saleorApiUrl, appId: payload.appId };
}
