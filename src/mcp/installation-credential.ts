import { createHash } from "node:crypto";

import type { AuthData } from "@saleor/app-sdk/APL";
import { importPKCS8, importSPKI, jwtVerify, SignJWT } from "jose";

const ISSUER = "saleor-mcp";
const AUDIENCE = "saleor-mcp-client";

export class InstallationCredentialConfigurationError extends Error {}
export class InvalidInstallationCredentialError extends Error {}
export class InactiveInstallationCredentialError extends Error {}

type InstallationResolver = (saleorApiUrl: string) => Promise<AuthData | undefined>;

let cachedSigningKey: { pem: string; key: ReturnType<typeof importPKCS8> } | undefined;
let cachedVerificationKey: { pem: string; key: ReturnType<typeof importSPKI> } | undefined;

function installationFingerprint(token: string): string {
  return createHash("sha256").update(token).digest("base64url");
}

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
  const pem = readKey("MCP_CREDENTIAL_PRIVATE_KEY");
  if (cachedSigningKey?.pem === pem) return cachedSigningKey.key;

  const key = importPKCS8(pem, "RS512").catch((error) => {
    throw new InstallationCredentialConfigurationError(
      "MCP_CREDENTIAL_PRIVATE_KEY must contain a valid PKCS8 RSA private key.",
      { cause: error },
    );
  });
  cachedSigningKey = { pem, key };
  return key;
}

async function verificationKey() {
  const pem = readKey("MCP_CREDENTIAL_PUBLIC_KEY");
  if (cachedVerificationKey?.pem === pem) return cachedVerificationKey.key;

  const key = importSPKI(pem, "RS512").catch((error) => {
    throw new InstallationCredentialConfigurationError(
      "MCP_CREDENTIAL_PUBLIC_KEY must contain a valid SPKI RSA public key.",
      { cause: error },
    );
  });
  cachedVerificationKey = { pem, key };
  return key;
}

export async function issueInstallationCredential(authData: AuthData): Promise<string> {
  return new SignJWT({
    saleorApiUrl: authData.saleorApiUrl,
    appId: authData.appId,
    installationFingerprint: installationFingerprint(authData.token),
  })
    .setProtectedHeader({ alg: "RS512", typ: "JWT" })
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setSubject(authData.appId)
    .setIssuedAt()
    .sign(await signingKey());
}

export async function verifyInstallationCredential(
  credential: string,
  resolveInstallation: InstallationResolver,
): Promise<AuthData> {
  let payload;
  try {
    ({ payload } = await jwtVerify(credential, await verificationKey(), {
      issuer: ISSUER,
      audience: AUDIENCE,
      algorithms: ["RS512"],
    }));
  } catch (error) {
    if (error instanceof InstallationCredentialConfigurationError) throw error;
    throw new InvalidInstallationCredentialError("Invalid MCP installation credential.", {
      cause: error,
    });
  }

  if (
    typeof payload.saleorApiUrl !== "string" ||
    typeof payload.appId !== "string" ||
    typeof payload.installationFingerprint !== "string"
  ) {
    throw new InvalidInstallationCredentialError(
      "The installation credential is missing its installation identity.",
    );
  }

  const authData = await resolveInstallation(payload.saleorApiUrl);
  if (
    !authData ||
    authData.appId !== payload.appId ||
    installationFingerprint(authData.token) !== payload.installationFingerprint
  ) {
    throw new InactiveInstallationCredentialError(
      "This Saleor app installation is no longer active.",
    );
  }

  return authData;
}
