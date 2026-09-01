import { describe, expect, it } from "vitest";

import { buildClientSetup, buildClientSetupPreview } from "./dashboard-panel";

const connection = {
  saleorApiUrl: "https://shop.example.com/graphql/",
  mcpUrl: "https://mcp.example.com/mcp",
  credential: "signed-credential",
  config: {
    mcpServers: {
      saleor: {
        type: "http",
        url: "https://mcp.example.com/mcp",
        headers: { Authorization: "Bearer signed-credential" },
      },
    },
  },
};

describe("client connection setup", () => {
  it("builds a Codex configuration", () => {
    expect(buildClientSetup("codex", connection)).toBe(
      [
        "export SALEOR_MCP_TOKEN='signed-credential'",
        "codex mcp add saleor --url 'https://mcp.example.com/mcp' --bearer-token-env-var SALEOR_MCP_TOKEN",
      ].join("\n"),
    );
  });

  it("builds a Claude Code command", () => {
    expect(buildClientSetup("claude-code", connection)).toBe(
      [
        "claude mcp add --transport http --scope user saleor \\",
        "  'https://mcp.example.com/mcp' \\",
        "  --header 'Authorization: Bearer signed-credential'",
      ].join("\n"),
    );
  });

  it("keeps the generic JSON configuration for other clients", () => {
    expect(JSON.parse(buildClientSetup("other", connection))).toEqual(connection.config);
  });

  it.each(["codex", "claude-code", "other"] as const)(
    "hides the credential in the %s preview",
    (client) => {
      const preview = buildClientSetupPreview(client, connection);

      expect(preview).not.toContain(connection.credential);
      expect(preview).toContain("••••••••");
    },
  );
});
