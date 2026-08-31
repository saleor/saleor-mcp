export type Mode = "read_only" | "read_write";

export type PolicyConfig = {
  mode: Mode;
  allowedMutations: Set<string>;
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
  if (mode !== "read_only" && mode !== "read_write") {
    throw new Error(`Invalid SALEOR_MCP_MODE '${mode}'. Valid values: read_only, read_write`);
  }

  const allowedMutations = parseMutationSet(env.SALEOR_MCP_ALLOWED_MUTATIONS);

  return { mode, allowedMutations };
}
