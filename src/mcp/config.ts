export type Mode = "read_only" | "read_write" | "unrestricted";

export const DEFAULT_BLOCKED_MUTATIONS = new Set([
  "staffCreate",
  "staffUpdate",
  "staffDelete",
  "staffBulkDelete",
  "customerDelete",
  "customerBulkDelete",
  "userAvatarDelete",
  "setPassword",
  "requestPasswordReset",
  "permissionGroupCreate",
  "permissionGroupUpdate",
  "permissionGroupDelete",
  "appCreate",
  "appUpdate",
  "appDelete",
  "appDeleteFailedInstallation",
  "appInstall",
  "appRetryInstall",
  "appActivate",
  "appDeactivate",
  "appTokenCreate",
  "appTokenDelete",
  "appTokenVerify",
  "tokenCreate",
  "tokenRefresh",
  "tokensDeactivateAll",
  "externalLogout",
  "pluginUpdate",
  "shopSettingsUpdate",
  "shopDomainUpdate",
  "shopAddressUpdate",
  "channelDelete",
  "webhookCreate",
  "webhookUpdate",
  "webhookDelete",
]);

export type PolicyConfig = {
  mode: Mode;
  effectiveBlocklist: Set<string>;
};

function parseMutationSet(value: string | undefined): Set<string> {
  return new Set(
    (value ?? "")
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean),
  );
}

export function getPolicyConfig(
  env: Record<string, string | undefined> = process.env,
): PolicyConfig {
  const mode = (env.SALEOR_MCP_MODE ?? "read_only").trim().toLowerCase();
  if (mode !== "read_only" && mode !== "read_write" && mode !== "unrestricted") {
    throw new Error(
      `Invalid SALEOR_MCP_MODE '${mode}'. Valid values: read_only, read_write, unrestricted`,
    );
  }

  const blockedMutations = new Set([
    ...DEFAULT_BLOCKED_MUTATIONS,
    ...parseMutationSet(env.SALEOR_MCP_BLOCKED_MUTATIONS),
  ]);
  const allowedMutations = parseMutationSet(env.SALEOR_MCP_ALLOWED_MUTATIONS);
  const effectiveBlocklist =
    mode === "read_write"
      ? new Set([...blockedMutations].filter((name) => !allowedMutations.has(name)))
      : new Set<string>();

  return { mode, effectiveBlocklist };
}
