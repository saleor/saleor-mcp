import { useAppBridge, useAuthenticatedFetch } from "@saleor/app-sdk/app-bridge";
import { useEffect, useMemo, useState } from "react";

import type { Mode, SerializedPolicyConfig } from "@/mcp/config";
import {
  DEFAULT_MCP_SCOPES,
  MCP_SCOPE_CATALOG,
  type McpScope,
  type McpScopeDefinition,
} from "@/mcp/scopes";

type Connection = {
  saleorApiUrl: string;
  mcpUrl: string;
  mode: Mode;
  credential: string;
  config: Record<string, unknown>;
};

type SettingsResponse = {
  policy: SerializedPolicyConfig;
  source: "default" | "private_metadata" | "invalid_private_metadata";
  warning?: string;
};

type EditablePolicy = Pick<
  SerializedPolicyConfig,
  "enabledScopes" | "defaultScopes" | "mode" | "allowedMutations"
>;

const modeOptions: Array<{
  value: Mode;
  title: string;
  description: string;
  badge?: string;
}> = [
  {
    value: "read_only",
    title: "Read only",
    description: "Allow schema discovery and queries. Block every GraphQL mutation.",
    badge: "Recommended",
  },
  {
    value: "read_write",
    title: "Reviewed writes",
    description: "Allow only the mutation fields listed below. Everything else stays blocked.",
  },
  {
    value: "unrestricted",
    title: "Unrestricted writes",
    description:
      "Allow any mutation covered by the permissions granted when the app was installed.",
    badge: "High risk",
  },
];

function errorMessage(payload: unknown, fallback: string): string {
  if (
    payload &&
    typeof payload === "object" &&
    "error" in payload &&
    typeof payload.error === "string"
  ) {
    return payload.error;
  }
  return fallback;
}

function mutationsFromText(value: string): string[] {
  return [
    ...new Set(
      value
        .split(/[\s,]+/)
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  ].sort();
}

const scopeGroups = MCP_SCOPE_CATALOG.reduce<Array<[string, McpScopeDefinition[]]>>(
  (groups, definition) => {
    const current = groups.at(-1);
    if (current?.[0] === definition.group) current[1].push(definition);
    else groups.push([definition.group, [definition]]);
    return groups;
  },
  [],
);

function titleCase(value: string): string {
  return value
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function scopesInCatalogOrder(values: Iterable<McpScope>): McpScope[] {
  const selected = new Set(values);
  return MCP_SCOPE_CATALOG.filter(({ id }) => selected.has(id)).map(({ id }) => id);
}

export default function DashboardPanel() {
  const { appBridgeState } = useAppBridge();
  const authenticatedFetch = useAuthenticatedFetch();
  const [connection, setConnection] = useState<Connection>();
  const [policy, setPolicy] = useState<EditablePolicy>();
  const [savedPolicy, setSavedPolicy] = useState<EditablePolicy>();
  const [mutationDraft, setMutationDraft] = useState("");
  const [settingsSource, setSettingsSource] = useState<SettingsResponse["source"]>();
  const [metadataWarning, setMetadataWarning] = useState<string>();
  const [loadError, setLoadError] = useState<string>();
  const [saveError, setSaveError] = useState<string>();
  const [isSaving, setIsSaving] = useState(false);
  const [savedNotice, setSavedNotice] = useState(false);
  const [copied, setCopied] = useState(false);
  const canManageApps = appBridgeState?.user?.permissions.includes("MANAGE_APPS") ?? false;

  useEffect(() => {
    if (!appBridgeState?.ready || !canManageApps) return;
    const controller = new AbortController();

    Promise.all([
      authenticatedFetch("/api/connection", { signal: controller.signal }).then(
        async (response) => {
          const body = (await response.json()) as unknown;
          if (!response.ok)
            throw new Error(errorMessage(body, "Could not create connection details."));
          return body as Connection;
        },
      ),
      authenticatedFetch("/api/settings", { signal: controller.signal }).then(async (response) => {
        const body = (await response.json()) as unknown;
        if (!response.ok)
          throw new Error(errorMessage(body, "Could not load permission settings."));
        return body as SettingsResponse;
      }),
    ])
      .then(([connectionDetails, settings]) => {
        const loadedPolicy = {
          enabledScopes: settings.policy.enabledScopes,
          defaultScopes: settings.policy.defaultScopes,
          mode: settings.policy.mode,
          allowedMutations: settings.policy.allowedMutations,
        };
        setConnection(connectionDetails);
        setPolicy(loadedPolicy);
        setSavedPolicy(loadedPolicy);
        setMutationDraft(loadedPolicy.allowedMutations.join("\n"));
        setSettingsSource(settings.source);
        setMetadataWarning(settings.warning);
      })
      .catch((reason: unknown) => {
        if (!controller.signal.aborted)
          setLoadError(reason instanceof Error ? reason.message : String(reason));
      });

    return () => controller.abort();
  }, [appBridgeState?.ready, authenticatedFetch, canManageApps]);

  useEffect(() => {
    document.documentElement.dataset.theme = appBridgeState?.theme ?? "light";
  }, [appBridgeState?.theme]);

  const configText = useMemo(
    () => (connection ? JSON.stringify(connection.config, null, 2) : ""),
    [connection],
  );
  const isDirty = useMemo(
    () => JSON.stringify(policy) !== JSON.stringify(savedPolicy),
    [policy, savedPolicy],
  );

  const copyConfig = async () => {
    await navigator.clipboard.writeText(configText);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  };

  const setScopeEnabled = (scope: McpScope, enabled: boolean) => {
    if (!policy) return;
    const enabledScopes = new Set(policy.enabledScopes);
    const defaultScopes = new Set(policy.defaultScopes);
    if (enabled) enabledScopes.add(scope);
    else {
      enabledScopes.delete(scope);
      defaultScopes.delete(scope);
    }
    setPolicy({
      ...policy,
      enabledScopes: scopesInCatalogOrder(enabledScopes),
      defaultScopes: scopesInCatalogOrder(defaultScopes),
    });
  };

  const setScopeDefault = (scope: McpScope, selected: boolean) => {
    if (!policy || !policy.enabledScopes.includes(scope)) return;
    const defaultScopes = new Set(policy.defaultScopes);
    if (selected) defaultScopes.add(scope);
    else defaultScopes.delete(scope);
    setPolicy({ ...policy, defaultScopes: scopesInCatalogOrder(defaultScopes) });
  };

  const savePolicy = async () => {
    if (!policy || isSaving) return;
    setIsSaving(true);
    setSaveError(undefined);
    setSavedNotice(false);
    try {
      const response = await authenticatedFetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(policy),
      });
      const body = (await response.json()) as unknown;
      if (!response.ok) throw new Error(errorMessage(body, "Could not save permission settings."));
      const settings = body as SettingsResponse;
      const nextPolicy = {
        enabledScopes: settings.policy.enabledScopes,
        defaultScopes: settings.policy.defaultScopes,
        mode: settings.policy.mode,
        allowedMutations: settings.policy.allowedMutations,
      };
      setPolicy(nextPolicy);
      setSavedPolicy(nextPolicy);
      setMutationDraft(nextPolicy.allowedMutations.join("\n"));
      setSettingsSource(settings.source);
      setMetadataWarning(undefined);
      setSavedNotice(true);
      window.setTimeout(() => setSavedNotice(false), 2500);
    } catch (reason) {
      setSaveError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setIsSaving(false);
    }
  };

  if (!appBridgeState?.ready) {
    return (
      <main className="configuration-shell">
        <section className="configuration-loading">Connecting to Saleor Dashboard…</section>
      </main>
    );
  }

  if (!canManageApps) {
    return (
      <main className="configuration-shell">
        <section className="settings-card missing-access">
          <span className="eyebrow">Saleor MCP</span>
          <h1>Administrator access required</h1>
          <p>
            A staff member with Manage Apps permission must open this page to view connection
            details or change the installation&apos;s MCP permissions.
          </p>
        </section>
      </main>
    );
  }

  return (
    <main className="configuration-shell">
      <header className="configuration-header">
        <div>
          <span className="eyebrow">Saleor MCP</span>
          <h1>Configuration</h1>
        </div>
        <a href="https://github.com/saleor/saleor-mcp" target="_blank" rel="noreferrer">
          Documentation <span aria-hidden="true">↗</span>
        </a>
      </header>

      {loadError ? <div className="inline-error page-message">{loadError}</div> : null}

      {!connection || !policy ? (
        !loadError ? (
          <section className="configuration-loading">Loading configuration…</section>
        ) : null
      ) : (
        <>
          <div className="settings-layout">
            <div className="settings-content">
              {metadataWarning ? (
                <div className="settings-warning" role="status">
                  <strong>Saved settings need attention</strong>
                  <span>{metadataWarning}</span>
                </div>
              ) : null}

              <section className="settings-card">
                <header className="settings-card-header">
                  <div>
                    <h2>Client connection</h2>
                    <p>Use this endpoint when adding Saleor MCP to an AI assistant.</p>
                  </div>
                  <span className="status-badge">Installed</span>
                </header>

                <dl className="connection-facts">
                  <div>
                    <dt>Saleor API</dt>
                    <dd>{connection.saleorApiUrl}</dd>
                  </div>
                  <div>
                    <dt>MCP endpoint</dt>
                    <dd>{connection.mcpUrl}</dd>
                  </div>
                </dl>

                <div className="code-frame">
                  <div className="code-toolbar">
                    <span>MCP configuration</span>
                    <button type="button" onClick={copyConfig}>
                      {copied ? "Copied" : "Copy"}
                    </button>
                  </div>
                  <pre>
                    <code>{configText}</code>
                  </pre>
                </div>
                <p className="credential-note">
                  Treat this configuration like a password. It identifies this installation and
                  stops working after the app is uninstalled or reinstalled.
                </p>
              </section>

              <section className="settings-card scopes-card">
                <header className="settings-card-header scope-card-header">
                  <div>
                    <h2>Client permission ceiling</h2>
                    <p>
                      Choose which scopes clients may request, and which scopes apply when a client
                      does not request a specific set.
                    </p>
                  </div>
                  <span className="scope-count">{policy.enabledScopes.length} enabled</span>
                </header>

                <div className="scope-toolbar">
                  <div>
                    <span className="scope-column-label">Available</span>
                    <span className="scope-column-label">Default</span>
                  </div>
                  <div>
                    <button
                      type="button"
                      onClick={() =>
                        setPolicy({
                          ...policy,
                          enabledScopes: [...DEFAULT_MCP_SCOPES],
                          defaultScopes: [...DEFAULT_MCP_SCOPES],
                        })
                      }
                    >
                      Use recommended
                    </button>
                    <button
                      type="button"
                      onClick={() => setPolicy({ ...policy, enabledScopes: [], defaultScopes: [] })}
                    >
                      Disable all
                    </button>
                  </div>
                </div>

                <div className="scope-groups">
                  {scopeGroups.map(([group, definitions]) => (
                    <section className="scope-group" key={group}>
                      <h3>{titleCase(group)}</h3>
                      {definitions.map((definition) => {
                        const enabled = policy.enabledScopes.includes(definition.id);
                        const selectedByDefault = policy.defaultScopes.includes(definition.id);
                        return (
                          <div
                            className={`scope-row ${enabled ? "enabled" : ""}`}
                            key={definition.id}
                          >
                            <div className="scope-copy">
                              <div>
                                <strong>{definition.title}</strong>
                                <span className={`access-tag access-${definition.access}`}>
                                  {definition.access}
                                </span>
                                {definition.risk !== "standard" ? (
                                  <span className={`risk-tag risk-${definition.risk}`}>
                                    {definition.risk} risk
                                  </span>
                                ) : null}
                              </div>
                              <p>{definition.description}</p>
                              <code>{definition.id}</code>
                            </div>
                            <label className="scope-checkbox">
                              <span className="sr-only">Enable {definition.title}</span>
                              <input
                                type="checkbox"
                                checked={enabled}
                                onChange={(event) =>
                                  setScopeEnabled(definition.id, event.target.checked)
                                }
                              />
                            </label>
                            <label className="scope-checkbox">
                              <span className="sr-only">Use {definition.title} by default</span>
                              <input
                                type="checkbox"
                                checked={selectedByDefault}
                                disabled={!enabled}
                                onChange={(event) =>
                                  setScopeDefault(definition.id, event.target.checked)
                                }
                              />
                            </label>
                          </div>
                        );
                      })}
                    </section>
                  ))}
                </div>
              </section>

              <section className="settings-card permissions-card">
                <header className="settings-card-header">
                  <div>
                    <h2>GraphQL write access</h2>
                    <p>Set the maximum level of mutation access for this installation.</p>
                  </div>
                  <span className={`mode-badge mode-${policy.mode}`}>
                    {modeOptions.find(({ value }) => value === policy.mode)?.title}
                  </span>
                </header>

                <fieldset className="mode-options">
                  <legend>Permission mode</legend>
                  {modeOptions.map((option) => (
                    <label
                      className={`mode-option ${policy.mode === option.value ? "selected" : ""}`}
                      key={option.value}
                    >
                      <input
                        type="radio"
                        name="permission-mode"
                        value={option.value}
                        checked={policy.mode === option.value}
                        onChange={() => setPolicy({ ...policy, mode: option.value })}
                      />
                      <span className="mode-option-copy">
                        <span className="mode-option-title">
                          <strong>{option.title}</strong>
                          {option.badge ? <small>{option.badge}</small> : null}
                        </span>
                        <span>{option.description}</span>
                      </span>
                    </label>
                  ))}
                </fieldset>

                {policy.mode === "read_write" ? (
                  <div className="mutation-field">
                    <label htmlFor="allowed-mutations">Allowed mutation fields</label>
                    <p>
                      Enter GraphQL root mutation names separated by commas, spaces, or new lines.
                    </p>
                    <textarea
                      id="allowed-mutations"
                      rows={7}
                      spellCheck={false}
                      placeholder={"productCreate\nproductUpdate\norderUpdate"}
                      value={mutationDraft}
                      onChange={(event) => {
                        setMutationDraft(event.target.value);
                        setPolicy({
                          ...policy,
                          allowedMutations: mutationsFromText(event.target.value),
                        });
                      }}
                    />
                    {policy.allowedMutations.length === 0 ? (
                      <span className="field-warning">
                        No mutations are listed, so this mode currently permits no writes.
                      </span>
                    ) : (
                      <span className="field-hint">
                        {policy.allowedMutations.length} mutation
                        {policy.allowedMutations.length === 1 ? "" : "s"} allowed
                      </span>
                    )}
                  </div>
                ) : null}

                {policy.mode === "unrestricted" ? (
                  <div className="danger-notice">
                    <strong>Use unrestricted access only for trusted clients.</strong>
                    <span>
                      The installed app&apos;s Saleor permissions remain the final ceiling, but the
                      MCP server will not apply a mutation allowlist.
                    </span>
                  </div>
                ) : null}
              </section>
            </div>

            <aside className="settings-aside">
              <section>
                <h2>How permissions work</h2>
                <p>
                  These settings are stored privately on this installed Saleor App and apply only to
                  this Saleor instance.
                </p>
              </section>
              <ol>
                <li>
                  <span>1</span>
                  <p>
                    <strong>Installation ceiling</strong>
                    Only enabled scopes can be requested by a client.
                  </p>
                </li>
                <li>
                  <span>2</span>
                  <p>
                    <strong>User authorization</strong>
                    The authorizing user can grant only permissions they hold.
                  </p>
                </li>
                <li>
                  <span>3</span>
                  <p>
                    <strong>Write safety</strong>
                    Mutation mode and allowlist add a final fail-closed check.
                  </p>
                </li>
              </ol>
              <p className="metadata-source">
                {settingsSource === "default"
                  ? "Using safe defaults until settings are saved."
                  : settingsSource === "private_metadata"
                    ? "Saved in app private metadata."
                    : "Invalid metadata replaced with safe defaults in this view."}
              </p>
            </aside>
          </div>

          <footer className="settings-savebar">
            <div aria-live="polite">
              {saveError ? <span className="save-error">{saveError}</span> : null}
              {!saveError && savedNotice ? (
                <span className="save-success">Changes saved</span>
              ) : null}
              {!saveError && !savedNotice && isDirty ? <span>Unsaved changes</span> : null}
            </div>
            <div>
              <button
                type="button"
                className="secondary-button"
                disabled={!isDirty || isSaving}
                onClick={() => {
                  setPolicy(savedPolicy);
                  setMutationDraft(savedPolicy?.allowedMutations.join("\n") ?? "");
                }}
              >
                Discard
              </button>
              <button
                type="button"
                className="primary-button"
                disabled={!isDirty || isSaving}
                onClick={() => void savePolicy()}
              >
                {isSaving ? "Saving…" : "Save changes"}
              </button>
            </div>
          </footer>
        </>
      )}
    </main>
  );
}
