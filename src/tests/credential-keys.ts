import { generateKeyPairSync } from "node:crypto";

import { vi } from "vitest";

function createKeyPair() {
  return generateKeyPairSync("rsa", {
    modulusLength: 2048,
    publicKeyEncoding: { type: "spki", format: "pem" },
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
  });
}

const primary = createKeyPair();
const secondary = createKeyPair();

export function stubCredentialKeys() {
  vi.stubEnv("MCP_CREDENTIAL_PRIVATE_KEY", primary.privateKey);
  vi.stubEnv("MCP_CREDENTIAL_PUBLIC_KEY", primary.publicKey);
}

export const otherCredentialPublicKey = secondary.publicKey;
