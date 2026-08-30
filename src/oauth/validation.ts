import { isLoopbackHost } from "./config";

export class OAuthRequestError extends Error {
  constructor(
    public readonly oauthError: string,
    message: string,
    public readonly status = 400,
  ) {
    super(message);
  }
}

export function single(value: string | string[] | undefined, name: string, required = true) {
  if (Array.isArray(value))
    throw new OAuthRequestError("invalid_request", `${name} must occur once.`);
  if (required && !value) throw new OAuthRequestError("invalid_request", `${name} is required.`);
  return value;
}

export function validateRedirectUri(raw: string) {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new OAuthRequestError("invalid_redirect_uri", "redirect_uri must be an absolute URL.");
  }
  if (url.hash || url.username || url.password) {
    throw new OAuthRequestError(
      "invalid_redirect_uri",
      "redirect_uri contains a forbidden component.",
    );
  }
  if (url.protocol !== "https:" && !(url.protocol === "http:" && isLoopbackHost(url.hostname))) {
    throw new OAuthRequestError(
      "invalid_redirect_uri",
      "redirect_uri must use HTTPS or loopback HTTP.",
    );
  }
  return raw;
}

export function validatePkceChallenge(value: string, method: string | undefined) {
  if (method !== "S256")
    throw new OAuthRequestError("invalid_request", "Only PKCE S256 is supported.");
  if (!/^[A-Za-z0-9_-]{43}$/.test(value)) {
    throw new OAuthRequestError("invalid_request", "code_challenge must be an S256 digest.");
  }
  return value;
}

export function validateCodeVerifier(value: string) {
  if (!/^[A-Za-z0-9._~-]{43,128}$/.test(value)) {
    throw new OAuthRequestError("invalid_grant", "Invalid PKCE code_verifier.");
  }
  return value;
}

export function formBody(body: unknown): URLSearchParams {
  if (typeof body === "string") return new URLSearchParams(body);
  if (body && typeof body === "object" && !Array.isArray(body)) {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(body)) {
      if (typeof value === "string") params.append(key, value);
    }
    return params;
  }
  return new URLSearchParams();
}

export function noStore(response: { setHeader(name: string, value: string): unknown }) {
  response.setHeader("Cache-Control", "no-store");
  response.setHeader("Pragma", "no-cache");
}
