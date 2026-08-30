import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DeleteCommand,
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
} from "@aws-sdk/lib-dynamodb";

export type InstallationOAuthSettings = {
  installationId: string;
  saleorApiUrl: string;
  appId: string;
  dashboardOrigin: string;
  updatedAt: number;
};

export type OAuthClient = {
  clientId: string;
  installationId: string;
  clientName: string;
  redirectUris: string[];
  grantTypes: string[];
  responseTypes: string[];
  tokenEndpointAuthMethod: "none";
  createdAt: number;
};

export type PendingAuthorization = {
  requestId: string;
  installationId: string;
  clientId: string;
  redirectUri: string;
  resource: string;
  scopes: string[];
  state?: string;
  codeChallenge: string;
  expiresAt: number;
};

export type AuthorizationCodeGrant = Omit<
  PendingAuthorization,
  "requestId" | "state" | "expiresAt"
> & {
  codeHash: string;
  subject: string;
  userEmail: string;
  saleorPermissions: string[];
  expiresAt: number;
};

export type RefreshTokenGrant = {
  tokenHash: string;
  installationId: string;
  clientId: string;
  resource: string;
  scopes: string[];
  subject: string;
  userEmail: string;
  saleorPermissions: string[];
  expiresAt: number;
};

export interface OAuthStore {
  putInstallation(settings: InstallationOAuthSettings): Promise<void>;
  getInstallation(installationId: string): Promise<InstallationOAuthSettings | undefined>;
  putClient(client: OAuthClient): Promise<void>;
  getClient(installationId: string, clientId: string): Promise<OAuthClient | undefined>;
  putAuthorizationRequest(request: PendingAuthorization): Promise<void>;
  getAuthorizationRequest(requestId: string): Promise<PendingAuthorization | undefined>;
  consumeAuthorizationRequest(requestId: string): Promise<PendingAuthorization | undefined>;
  putAuthorizationCode(grant: AuthorizationCodeGrant): Promise<void>;
  consumeAuthorizationCode(codeHash: string): Promise<AuthorizationCodeGrant | undefined>;
  putRefreshToken(grant: RefreshTokenGrant): Promise<void>;
  consumeRefreshToken(tokenHash: string): Promise<RefreshTokenGrant | undefined>;
  deleteRefreshToken(tokenHash: string): Promise<void>;
  revokeAccessToken(jti: string, expiresAt: number): Promise<void>;
  isAccessTokenRevoked(jti: string): Promise<boolean>;
}

type StoredValue =
  | InstallationOAuthSettings
  | OAuthClient
  | PendingAuthorization
  | AuthorizationCodeGrant
  | RefreshTokenGrant
  | { jti: string; expiresAt: number };

export class MemoryOAuthStore implements OAuthStore {
  private readonly values = new Map<string, StoredValue>();

  private live<T extends StoredValue>(key: string): T | undefined {
    const value = this.values.get(key) as T | undefined;
    if (value && "expiresAt" in value && value.expiresAt <= Date.now()) {
      this.values.delete(key);
      return undefined;
    }
    return value;
  }

  private take<T extends StoredValue>(key: string): T | undefined {
    const value = this.live<T>(key);
    this.values.delete(key);
    return value;
  }

  async putInstallation(value: InstallationOAuthSettings) {
    this.values.set(`installation:${value.installationId}`, structuredClone(value));
  }
  async getInstallation(id: string) {
    return structuredClone(this.live<InstallationOAuthSettings>(`installation:${id}`));
  }
  async putClient(value: OAuthClient) {
    this.values.set(`client:${value.installationId}:${value.clientId}`, structuredClone(value));
  }
  async getClient(installationId: string, clientId: string) {
    return structuredClone(this.live<OAuthClient>(`client:${installationId}:${clientId}`));
  }
  async putAuthorizationRequest(value: PendingAuthorization) {
    this.values.set(`request:${value.requestId}`, structuredClone(value));
  }
  async getAuthorizationRequest(id: string) {
    return structuredClone(this.live<PendingAuthorization>(`request:${id}`));
  }
  async consumeAuthorizationRequest(id: string) {
    return structuredClone(this.take<PendingAuthorization>(`request:${id}`));
  }
  async putAuthorizationCode(value: AuthorizationCodeGrant) {
    this.values.set(`code:${value.codeHash}`, structuredClone(value));
  }
  async consumeAuthorizationCode(hash: string) {
    return structuredClone(this.take<AuthorizationCodeGrant>(`code:${hash}`));
  }
  async putRefreshToken(value: RefreshTokenGrant) {
    this.values.set(`refresh:${value.tokenHash}`, structuredClone(value));
  }
  async consumeRefreshToken(hash: string) {
    return structuredClone(this.take<RefreshTokenGrant>(`refresh:${hash}`));
  }
  async deleteRefreshToken(hash: string) {
    this.values.delete(`refresh:${hash}`);
  }
  async revokeAccessToken(jti: string, expiresAt: number) {
    this.values.set(`revoked:${jti}`, { jti, expiresAt });
  }
  async isAccessTokenRevoked(jti: string) {
    return Boolean(this.live(`revoked:${jti}`));
  }
}

class DynamoOAuthStore implements OAuthStore {
  constructor(
    private readonly client: DynamoDBDocumentClient,
    private readonly tableName: string,
  ) {}

  private async put(pk: string, value: StoredValue) {
    await this.client.send(
      new PutCommand({
        TableName: this.tableName,
        Item: {
          PK: pk,
          SK: "OAUTH",
          oauthPayload: JSON.stringify(value),
          ...("expiresAt" in value ? { expiresAt: Math.ceil(value.expiresAt / 1000) } : {}),
        },
      }),
    );
  }

  private decode<T extends StoredValue>(item: Record<string, unknown> | undefined): T | undefined {
    if (typeof item?.oauthPayload !== "string") return undefined;
    const value = JSON.parse(item.oauthPayload) as T;
    if ("expiresAt" in value && value.expiresAt <= Date.now()) return undefined;
    return value;
  }

  private async get<T extends StoredValue>(pk: string) {
    const result = await this.client.send(
      new GetCommand({ TableName: this.tableName, Key: { PK: pk, SK: "OAUTH" } }),
    );
    return this.decode<T>(result.Item);
  }

  private async take<T extends StoredValue>(pk: string) {
    const result = await this.client.send(
      new DeleteCommand({
        TableName: this.tableName,
        Key: { PK: pk, SK: "OAUTH" },
        ReturnValues: "ALL_OLD",
      }),
    );
    return this.decode<T>(result.Attributes);
  }

  putInstallation(value: InstallationOAuthSettings) {
    return this.put(`OAUTH#INSTALLATION#${value.installationId}`, value);
  }
  getInstallation(id: string) {
    return this.get<InstallationOAuthSettings>(`OAUTH#INSTALLATION#${id}`);
  }
  putClient(value: OAuthClient) {
    return this.put(`OAUTH#CLIENT#${value.installationId}#${value.clientId}`, value);
  }
  getClient(installationId: string, clientId: string) {
    return this.get<OAuthClient>(`OAUTH#CLIENT#${installationId}#${clientId}`);
  }
  putAuthorizationRequest(value: PendingAuthorization) {
    return this.put(`OAUTH#REQUEST#${value.requestId}`, value);
  }
  getAuthorizationRequest(id: string) {
    return this.get<PendingAuthorization>(`OAUTH#REQUEST#${id}`);
  }
  consumeAuthorizationRequest(id: string) {
    return this.take<PendingAuthorization>(`OAUTH#REQUEST#${id}`);
  }
  putAuthorizationCode(value: AuthorizationCodeGrant) {
    return this.put(`OAUTH#CODE#${value.codeHash}`, value);
  }
  consumeAuthorizationCode(hash: string) {
    return this.take<AuthorizationCodeGrant>(`OAUTH#CODE#${hash}`);
  }
  putRefreshToken(value: RefreshTokenGrant) {
    return this.put(`OAUTH#REFRESH#${value.tokenHash}`, value);
  }
  consumeRefreshToken(hash: string) {
    return this.take<RefreshTokenGrant>(`OAUTH#REFRESH#${hash}`);
  }
  async deleteRefreshToken(hash: string) {
    await this.client.send(
      new DeleteCommand({
        TableName: this.tableName,
        Key: { PK: `OAUTH#REFRESH#${hash}`, SK: "OAUTH" },
      }),
    );
  }
  revokeAccessToken(jti: string, expiresAt: number) {
    return this.put(`OAUTH#REVOKED#${jti}`, { jti, expiresAt });
  }
  async isAccessTokenRevoked(jti: string) {
    return Boolean(await this.get(`OAUTH#REVOKED#${jti}`));
  }
}

let singleton: OAuthStore | undefined;

export function getOAuthStore(env: NodeJS.ProcessEnv = process.env): OAuthStore {
  if (singleton) return singleton;
  const provider =
    env.OAUTH_STORE_PROVIDER ??
    env.APL_PROVIDER ??
    (env.NODE_ENV === "production" ? "dynamodb" : "memory");
  if (provider === "memory" || provider === "file") {
    if (env.NODE_ENV === "production")
      throw new Error("The in-memory OAuth store is not safe in production.");
    singleton = new MemoryOAuthStore();
    return singleton;
  }
  if (provider !== "dynamodb") throw new Error(`Unsupported OAUTH_STORE_PROVIDER: ${provider}`);
  if (!env.APL_DYNAMODB_TABLE)
    throw new Error("APL_DYNAMODB_TABLE is required for the OAuth store.");
  const client = DynamoDBDocumentClient.from(new DynamoDBClient({ region: env.AWS_REGION }), {
    marshallOptions: { removeUndefinedValues: true },
  });
  singleton = new DynamoOAuthStore(client, env.APL_DYNAMODB_TABLE);
  return singleton;
}

export function setOAuthStoreForTests(store: OAuthStore | undefined) {
  singleton = store;
}
