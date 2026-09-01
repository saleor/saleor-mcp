import { actions, useAppBridge, useAuthenticatedFetch } from "@saleor/app-sdk/app-bridge";
import type { AppPermission } from "@saleor/app-sdk/types";
import { useEffect, useMemo, useState } from "react";

import { permissionOptions } from "@/saleor-app/permissions";

import {
  AppPageShell,
  AsideInfoCard,
  CollapsibleSettingsSection,
  DashboardLoading,
  SettingsPageContent,
  SettingsSection,
} from "./app-page-shell";

const DOCUMENTATION_URL = "https://github.com/saleor/saleor-mcp";

type Connection = {
  saleorApiUrl: string;
  mcpUrl: string;
  credential: string;
  config: Record<string, unknown>;
};

type ClientSetup = "codex" | "claude-code" | "other";

const clientSetups = [
  {
    id: "codex",
    name: "Codex",
  },
  {
    id: "claude-code",
    name: "Claude Code",
  },
  {
    id: "other",
    name: "Other client",
  },
] as const satisfies ReadonlyArray<{
  id: ClientSetup;
  name: string;
}>;

const permissionGroups = [
  "Store operations",
  "Promotions",
  "Delivery and taxes",
  "Content",
] as const;

async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return;
  } catch {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.readOnly = true;
    textarea.style.position = "fixed";
    textarea.style.left = "-9999px";
    document.body.appendChild(textarea);
    textarea.select();
    const copied = document.execCommand("copy");
    textarea.remove();
    if (!copied) throw new Error("Copy command was rejected.");
  }
}

async function connectionError(response: Response) {
  const fallback = "Could not create connection details. Please try again.";

  try {
    const body = JSON.parse(await response.text()) as { error?: unknown };
    return typeof body.error === "string" ? body.error : fallback;
  } catch {
    return fallback;
  }
}

function shellQuote(value: string) {
  return `'${value.replaceAll("'", `'"'"'`)}'`;
}

export function buildClientSetup(client: ClientSetup, connection: Connection) {
  if (client === "codex") {
    return [
      `export SALEOR_MCP_TOKEN=${shellQuote(connection.credential)}`,
      `codex mcp add saleor --url ${shellQuote(connection.mcpUrl)} --bearer-token-env-var SALEOR_MCP_TOKEN`,
    ].join("\n");
  }

  if (client === "claude-code") {
    return [
      "claude mcp add --transport http --scope user saleor \\",
      `  ${shellQuote(connection.mcpUrl)} \\`,
      `  --header ${shellQuote(`Authorization: Bearer ${connection.credential}`)}`,
    ].join("\n");
  }

  return JSON.stringify(connection.config, null, 2);
}

export function buildClientSetupPreview(client: ClientSetup, connection: Connection) {
  return buildClientSetup(client, connection).replaceAll(connection.credential, "••••••••");
}

const clientInstructions: Record<
  ClientSetup,
  { title: string; label: string; copyLabel: string; copied: string }
> = {
  codex: {
    title: "Connect with Codex",
    label: "Run these commands, then launch Codex from the same terminal.",
    copyLabel: "Copy commands",
    copied: "Commands copied",
  },
  "claude-code": {
    title: "Connect with Claude Code",
    label: "Copy and run this command in a terminal.",
    copyLabel: "Copy command",
    copied: "Command copied",
  },
  other: {
    title: "Connect another client",
    label: "Paste this JSON into your client's MCP server settings.",
    copyLabel: "Copy JSON configuration",
    copied: "JSON configuration copied",
  },
};

const CheckIcon = () => (
  <svg aria-hidden="true" focusable="false" viewBox="0 0 16 16">
    <path d="m3 8.2 3.1 3.1L13 4.8" />
  </svg>
);

const ShieldIcon = () => (
  <svg aria-hidden="true" focusable="false" viewBox="0 0 20 20">
    <path d="M10 2.5 16 5v4.4c0 3.7-2.5 6.5-6 8.1-3.5-1.6-6-4.4-6-8.1V5l6-2.5Z" />
    <path d="m7.4 9.9 1.7 1.7 3.7-4" />
  </svg>
);

const ChevronIcon = () => (
  <svg aria-hidden="true" focusable="false" viewBox="0 0 16 16">
    <path d="m4 6 4 4 4-4" />
  </svg>
);

function ClientIcon({ client }: { client: ClientSetup }) {
  if (client === "codex") {
    return (
      <span className="client-icon client-icon-codex" aria-hidden="true">
        <svg viewBox="0 0 24 24" focusable="false">
          <path d="M22.2819 9.8211a5.9847 5.9847 0 0 0-.5157-4.9108 6.0462 6.0462 0 0 0-6.5098-2.9A6.0651 6.0651 0 0 0 4.9807 4.1818a5.9847 5.9847 0 0 0-3.9977 2.9 6.0462 6.0462 0 0 0 .7427 7.0966 5.98 5.98 0 0 0 .511 4.9107 6.051 6.051 0 0 0 6.5146 2.9001A5.9847 5.9847 0 0 0 13.2599 24a6.0557 6.0557 0 0 0 5.7718-4.2058 5.9894 5.9894 0 0 0 3.9977-2.9001 6.0557 6.0557 0 0 0-.7475-7.0729Zm-9.022 12.6081a4.4755 4.4755 0 0 1-2.8764-1.0408l.1419-.0804 4.7783-2.7582a.7948.7948 0 0 0 .3927-.6813v-6.7369l2.02 1.1686a.071.071 0 0 1 .038.052v5.5826a4.504 4.504 0 0 1-4.4945 4.4944Zm-9.6607-4.1254a4.4708 4.4708 0 0 1-.5346-3.0137l.142.0852 4.783 2.7582a.7712.7712 0 0 0 .7806 0l5.8428-3.3685v2.3324a.0804.0804 0 0 1-.0332.0615L9.74 19.9502a4.4992 4.4992 0 0 1-6.1408-1.6464ZM2.3408 7.8956a4.485 4.485 0 0 1 2.3655-1.9728V11.6a.7664.7664 0 0 0 .3879.6765l5.8144 3.3543-2.0201 1.1685a.0757.0757 0 0 1-.071 0l-4.8303-2.7865A4.504 4.504 0 0 1 2.3408 7.872Zm16.5963 3.8558L13.1038 8.364 15.1192 7.2a.0757.0757 0 0 1 .071 0l4.8303 2.7913a4.4944 4.4944 0 0 1-.6765 8.1042v-5.6772a.79.79 0 0 0-.407-.667Zm2.0107-3.0231-.142-.0852-4.7735-2.7818a.7759.7759 0 0 0-.7854 0L9.409 9.2297V6.8974a.0662.0662 0 0 1 .0284-.0615l4.8303-2.7866a4.4992 4.4992 0 0 1 6.6802 4.66ZM8.3065 12.863l-2.02-1.1638a.0804.0804 0 0 1-.038-.0567V6.0742a4.4992 4.4992 0 0 1 7.3757-3.4537l-.142.0805L8.704 5.459a.7948.7948 0 0 0-.3927.6813Zm1.0976-2.3654 2.602-1.4998 2.6069 1.4998v2.9994l-2.5974 1.4997-2.6067-1.4997Z" />
        </svg>
      </span>
    );
  }

  if (client === "claude-code") {
    return (
      <span className="client-icon client-icon-claude" aria-hidden="true">
        <svg viewBox="0 0 24 24" focusable="false">
          <path d="m4.7144 15.9555 4.7174-2.6471.079-.2307-.079-.1275h-.2307l-.7893-.0486-2.6956-.0729-2.3375-.0971-2.2646-.1214-.5707-.1215-.5343-.7042.0546-.3522.4797-.3218.686.0608 1.5179.1032 2.2767.1578 1.6514.0972 2.4468.255h.3886l.0546-.1579-.1336-.0971-.1032-.0972L6.973 9.8356l-2.55-1.6879-1.3356-.9714-.7225-.4918-.3643-.4614-.1578-1.0078.6557-.7225.8803.0607.2246.0607.8925.686 1.9064 1.4754 2.4893 1.8336.3643.3035.1457-.1032.0182-.0728-.164-.2733-1.3539-2.4467-1.445-2.4893-.6435-1.032-.17-.6194c-.0607-.255-.1032-.4674-.1032-.7285L6.287.1335 6.6997 0l.9957.1336.419.3642.6192 1.4147 1.0018 2.2282 1.5543 3.0296.4553.8985.2429.8318.091.255h.1579v-.1457l.1275-1.706.2368-2.0947.2307-2.6957.0789-.7589.3764-.9107.7468-.4918.5828.2793.4797.686-.0668.4433-.2853 1.8517-.5586 2.9021-.3643 1.9429h.2125l.2429-.2429.9835-1.3053 1.6514-2.0643.7286-.8196.85-.9046.5464-.4311h1.0321l.759 1.1293-.34 1.1657-1.0625 1.3478-.8804 1.1414-1.2628 1.7-.7893 1.36.0729.1093.1882-.0183 2.8535-.607 1.5421-.2794 1.8396-.3157.8318.3886.091.3946-.3278.8075-1.967.4857-2.3072.4614-3.4364.8136-.0425.0304.0486.0607 1.5482.1457.6618.0364h1.621l3.0175.2247.7892.522.4736.6376-.079.4857-1.2142.6193-1.6393-.3886-3.825-.9107-1.3113-.3279h-.1822v.1093l1.0929 1.0686 2.0035 1.8092 2.5075 2.3314.1275.5768-.3218.4554-.34-.0486-2.2039-1.6575-.85-.7468-1.9246-1.621h-.1275v.17l.4432.6496 2.3436 3.5214.1214 1.0807-.17.3521-.6071.2125-.6679-.1214-1.3721-1.9246L14.38 17.959l-1.1414-1.9428-.1397.079-.674 7.2552-.3156.3703-.7286.2793-.6071-.4614-.3218-.7468.3218-1.4753.3886-1.9246.3157-1.53.2853-1.9004.17-.6314-.0121-.0425-.1397.0182-1.4328 1.9672-2.1796 2.9446-1.7243 1.8456-.4128.164-.7164-.3704.0667-.6618.4008-.5889 2.386-3.0357 1.4389-1.882.929-1.0868-.0062-.1579h-.0546l-6.3385 4.1164-1.1293.1457-.4857-.4554.0608-.7467.2307-.2429 1.9064-1.3114Z" />
        </svg>
      </span>
    );
  }

  return (
    <span className="client-icon client-icon-other" aria-hidden="true">
      <span>{`{ }`}</span>
    </span>
  );
}

function PermissionModeField() {
  return (
    <div className="permission-mode-field">
      <label htmlFor="mcp-permission-mode">Allowed actions</label>
      <div className="permission-mode-select">
        <select
          id="mcp-permission-mode"
          value="read_only"
          disabled
          aria-describedby="mcp-permission-mode-caption"
        >
          <option value="read_only">Read only</option>
        </select>
        <ChevronIcon />
      </div>
      <p id="mcp-permission-mode-caption">Saleor MCP is read-only at the moment.</p>
    </div>
  );
}

function OnboardingStatus() {
  return (
    <AsideInfoCard title="Onboarding status">
      <ol className="onboarding-steps">
        <li className="is-active" aria-current="step">
          <span className="onboarding-step-content">
            <span className="onboarding-step-number" aria-hidden="true">
              1
            </span>
            <span>
              <strong>Choose MCP permissions</strong>
              <p>Choose what the MCP can access.</p>
            </span>
          </span>
        </li>
        <li className="is-disabled">
          <span className="onboarding-step-content">
            <span className="onboarding-step-number" aria-hidden="true">
              2
            </span>
            <span>
              <strong>Connect an AI assistant</strong>
              <p>Copy the configuration into your MCP client.</p>
            </span>
          </span>
        </li>
      </ol>
    </AsideInfoCard>
  );
}

function summarizeAccessAreas(labels: string[]) {
  if (labels.length === 0) return undefined;
  if (labels.length === 1) return labels[0];
  if (labels.length === 2) return `${labels[0]} and ${labels[1]}`;

  const visibleLabels = labels.length > 5 ? labels.slice(0, 4) : labels.slice(0, -1);
  const finalLabel =
    labels.length > 5 ? `${labels.length - visibleLabels.length} more` : labels.at(-1);

  return `${visibleLabels.join(", ")}, and ${finalLabel}`;
}

function PermissionSummary({
  selectedPermissions,
  permissionsChanged,
  requestingPermissions,
  onReview,
}: {
  selectedPermissions: Set<AppPermission>;
  permissionsChanged: boolean;
  requestingPermissions: boolean;
  onReview: () => void;
}) {
  const accessAreas = summarizeAccessAreas(
    permissionOptions.filter(({ code }) => selectedPermissions.has(code)).map(({ label }) => label),
  );

  return (
    <div className="permission-summary" aria-live="polite">
      <ShieldIcon />
      <div>
        <strong>Permission summary</strong>
        <p>
          {accessAreas ? (
            <>
              Saleor MCP will authorize <b>reads</b> in <b>{accessAreas}</b>.
            </>
          ) : (
            "Saleor MCP will not authorize access to any areas."
          )}
        </p>
      </div>
      <button
        type="button"
        className="app-button app-button-primary"
        disabled={!permissionsChanged || selectedPermissions.size === 0 || requestingPermissions}
        onClick={onReview}
      >
        {requestingPermissions ? "Opening Saleor…" : "Review changes"}
      </button>
    </div>
  );
}

function ConfigurationSummary({
  connection,
  error,
  permissionCount,
}: {
  connection?: Connection;
  error?: string;
  permissionCount: number;
}) {
  const status = connection ? "Ready" : error ? "Needs attention" : "Preparing";
  const statusTone = connection ? "is-ready" : error ? "is-error" : "is-pending";
  let environment: string | undefined;

  if (connection) {
    try {
      environment = new URL(connection.saleorApiUrl).hostname;
    } catch {
      environment = connection.saleorApiUrl;
    }
  }

  return (
    <AsideInfoCard title="Connection">
      <dl className="aside-metadata">
        <div>
          <dt>Status</dt>
          <dd className={`aside-status ${statusTone}`}>
            <span aria-hidden="true" />
            {status}
          </dd>
        </div>
        <div>
          <dt>Allowed actions</dt>
          <dd>{connection ? "Read only" : "—"}</dd>
        </div>
        <div>
          <dt>Permissions</dt>
          <dd>{permissionCount} selected</dd>
        </div>
        <div>
          <dt>Saleor environment</dt>
          <dd title={connection?.saleorApiUrl}>{environment ?? "—"}</dd>
        </div>
      </dl>
    </AsideInfoCard>
  );
}

function PermissionControls({
  selectedPermissions,
  permissionsChanged,
  requestingPermissions,
  error,
  onSelectAll,
  onClear,
  onTogglePermission,
  onRequestPermissions,
  showPermissionsTitle = false,
  showDescription = true,
}: {
  selectedPermissions: Set<AppPermission>;
  permissionsChanged: boolean;
  requestingPermissions: boolean;
  error?: string;
  onSelectAll: () => void;
  onClear: () => void;
  onTogglePermission: (permission: AppPermission) => void;
  onRequestPermissions: () => void;
  showPermissionsTitle?: boolean;
  showDescription?: boolean;
}) {
  return (
    <>
      <div className="permission-toolbar">
        {showPermissionsTitle || showDescription ? (
          <div className="permission-toolbar-copy">
            {showPermissionsTitle ? (
              <strong className="permission-subtitle">Choose permissions</strong>
            ) : null}
            {showDescription ? (
              <p>Select the parts of Saleor the assistant should be able to read.</p>
            ) : null}
          </div>
        ) : null}
        <div className="permission-toolbar-actions">
          <button type="button" className="app-button app-button-tertiary" onClick={onSelectAll}>
            Select all
          </button>
          <button type="button" className="app-button app-button-tertiary" onClick={onClear}>
            Clear
          </button>
        </div>
      </div>

      <div className="permission-groups">
        {permissionGroups.map((group) => (
          <fieldset className="permission-group" key={group}>
            <legend>{group}</legend>
            {permissionOptions
              .filter((option) => option.group === group)
              .map((option) => (
                <label className="permission-option" key={option.code}>
                  <input
                    type="checkbox"
                    checked={selectedPermissions.has(option.code)}
                    onChange={() => onTogglePermission(option.code)}
                  />
                  <span className="permission-copy">
                    <strong>{option.label}</strong>
                    <code className="permission-code">{option.code}</code>
                  </span>
                </label>
              ))}
          </fieldset>
        ))}
      </div>

      <PermissionSummary
        selectedPermissions={selectedPermissions}
        permissionsChanged={permissionsChanged}
        requestingPermissions={requestingPermissions}
        onReview={onRequestPermissions}
      />

      {error ? (
        <div className="inline-error" role="alert">
          {error}
        </div>
      ) : null}
    </>
  );
}

export default function DashboardPanel() {
  const { appBridge, appBridgeState } = useAppBridge();
  const authenticatedFetch = useAuthenticatedFetch();
  const [connection, setConnection] = useState<Connection>();
  const [error, setError] = useState<string>();
  const [selectedClient, setSelectedClient] = useState<ClientSetup>("codex");
  const [copiedClient, setCopiedClient] = useState<ClientSetup>();
  const [permissionSelection, setPermissionSelection] = useState<Set<AppPermission>>();
  const [requestingPermissions, setRequestingPermissions] = useState(false);
  const [permissionsExpanded, setPermissionsExpanded] = useState(false);
  const canManageApps = appBridgeState?.user?.permissions.includes("MANAGE_APPS") ?? false;
  const appPermissions = appBridgeState?.appPermissions;
  const needsPermissions = (appPermissions?.length ?? 0) === 0;
  const selectedPermissions = useMemo(
    () => permissionSelection ?? new Set(appPermissions ?? []),
    [appPermissions, permissionSelection],
  );
  const permissionsChanged = useMemo(() => {
    if (!permissionSelection) return false;
    const originalPermissions = new Set(appPermissions ?? []);

    return (
      permissionSelection.size !== originalPermissions.size ||
      [...permissionSelection].some((permission) => !originalPermissions.has(permission))
    );
  }, [appPermissions, permissionSelection]);

  useEffect(() => {
    if (!appBridgeState?.ready || !canManageApps || needsPermissions) return;
    const controller = new AbortController();
    authenticatedFetch("/api/connection", { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error(await connectionError(response));
        return response.json() as Promise<Connection>;
      })
      .then(setConnection)
      .catch((reason: unknown) => {
        if (!controller.signal.aborted)
          setError(reason instanceof Error ? reason.message : String(reason));
      });
    return () => controller.abort();
  }, [appBridgeState?.ready, authenticatedFetch, canManageApps, needsPermissions]);

  useEffect(() => {
    document.documentElement.dataset.theme = appBridgeState?.theme ?? "light";
  }, [appBridgeState?.theme]);

  const setupText = useMemo(
    () => (connection ? buildClientSetup(selectedClient, connection) : ""),
    [connection, selectedClient],
  );
  const setupPreview = useMemo(
    () => (connection ? buildClientSetupPreview(selectedClient, connection) : ""),
    [connection, selectedClient],
  );

  const openDocumentation = async () => {
    if (!appBridge) return;
    try {
      await appBridge.dispatch(
        actions.Redirect({
          to: DOCUMENTATION_URL,
          newContext: true,
        }),
      );
    } catch {
      setError("Saleor could not open the documentation. Please try again.");
    }
  };

  const copySetup = async () => {
    try {
      await copyText(setupText);
      setError(undefined);
      setCopiedClient(selectedClient);
      window.setTimeout(() => setCopiedClient(undefined), 1800);
    } catch {
      setError("Could not copy the setup. Select the text and copy it manually.");
    }
  };

  const togglePermission = (permission: AppPermission) => {
    setPermissionSelection((current) => {
      const next = new Set(current ?? appPermissions ?? []);
      if (next.has(permission)) next.delete(permission);
      else next.add(permission);
      return next;
    });
  };

  const requestPermissions = async () => {
    if (!appBridge || !permissionsChanged || selectedPermissions.size === 0) return;
    setRequestingPermissions(true);
    setError(undefined);
    try {
      await appBridge.dispatch(
        actions.RequestPermissions([...selectedPermissions], "permissions-granted"),
      );
    } catch {
      setRequestingPermissions(false);
      setError("Saleor could not open the permission review. Please try again.");
    }
  };

  if (!appBridgeState?.ready) {
    return <DashboardLoading />;
  }

  if (!canManageApps) {
    return (
      <AppPageShell
        description="Connect an AI assistant to this Saleor environment."
        onOpenDocumentation={() => void openDocumentation()}
      >
        <SettingsPageContent aside={<OnboardingStatus />}>
          <SettingsSection
            title="MCP connection"
            description={
              <>
                Only staff with <code>MANAGE_APPS</code> can create connection details.
              </>
            }
          >
            <div className="empty-panel access-required-panel">
              <ShieldIcon />
              <div>
                <h3>
                  <code>MANAGE_APPS</code> permission required
                </h3>
                <p>Ask an administrator to open this page and finish the connection setup.</p>
              </div>
            </div>
          </SettingsSection>
        </SettingsPageContent>
      </AppPageShell>
    );
  }

  if (needsPermissions) {
    return (
      <AppPageShell
        description="Set up the permissions and connection details for this Saleor environment."
        onOpenDocumentation={() => void openDocumentation()}
      >
        <SettingsPageContent aside={<OnboardingStatus />}>
          <section className="first-run-intro" aria-labelledby="first-run-title">
            <div className="first-run-copy">
              <h2 id="first-run-title">Set up Saleor MCP</h2>
              <p>
                Saleor MCP lets AI assistants read data from this Saleor environment. Choose which
                permissions to grant, then copy the connection details into your assistant.
              </p>
            </div>
            <div className="first-run-assurances">
              <div>
                <CheckIcon />
                <span>
                  <strong>Read-only connection</strong>
                  Assistants can read the data you allow, but cannot make changes.
                </span>
              </div>
              <div>
                <ShieldIcon />
                <span>
                  <strong>One set of permissions</strong>
                  Your choices apply to every assistant using this connection.
                </span>
              </div>
            </div>
          </section>

          <CollapsibleSettingsSection
            title="Permissions"
            chip="Read only"
            count={`${selectedPermissions.size} selected`}
            expanded={permissionsExpanded}
            onToggle={() => setPermissionsExpanded((current) => !current)}
          >
            <PermissionModeField />
            <PermissionControls
              selectedPermissions={selectedPermissions}
              permissionsChanged={permissionsChanged}
              requestingPermissions={requestingPermissions}
              error={error}
              onSelectAll={() =>
                setPermissionSelection(new Set(permissionOptions.map(({ code }) => code)))
              }
              onClear={() => setPermissionSelection(new Set())}
              onTogglePermission={togglePermission}
              onRequestPermissions={() => void requestPermissions()}
              showPermissionsTitle
            />
          </CollapsibleSettingsSection>
        </SettingsPageContent>
      </AppPageShell>
    );
  }

  return (
    <AppPageShell
      description="Connect an AI assistant to this Saleor environment."
      onOpenDocumentation={() => void openDocumentation()}
    >
      <SettingsPageContent
        aside={
          <ConfigurationSummary
            connection={connection}
            error={error}
            permissionCount={appPermissions?.length ?? 0}
          />
        }
      >
        <SettingsSection
          title="Permissions"
          description="Control what connected assistants may do and which parts of Saleor they may access."
        >
          {connection ? <PermissionModeField /> : null}
          <button
            type="button"
            className="collapsible-settings-trigger permission-access-trigger"
            aria-expanded={permissionsExpanded}
            onClick={() => setPermissionsExpanded((current) => !current)}
          >
            <span className="permission-access-copy">
              <strong>Granted permissions</strong>
              <span>Select the parts of Saleor the assistant should be able to read.</span>
            </span>
            <span className="collapsible-settings-meta">
              <span className="count-badge">{appPermissions?.length ?? 0} selected</span>
              <ChevronIcon />
            </span>
          </button>
          {permissionsExpanded ? (
            <PermissionControls
              selectedPermissions={selectedPermissions}
              permissionsChanged={permissionsChanged}
              requestingPermissions={requestingPermissions}
              error={error}
              onSelectAll={() =>
                setPermissionSelection(new Set(permissionOptions.map(({ code }) => code)))
              }
              onClear={() => setPermissionSelection(new Set())}
              onTogglePermission={togglePermission}
              onRequestPermissions={() => void requestPermissions()}
              showDescription={false}
            />
          ) : null}
        </SettingsSection>
        <SettingsSection
          title="MCP connection"
          description="Choose your AI assistant, copy its setup, and follow the instruction below."
        >
          {error ? (
            <div className="inline-error connection-error" role="alert">
              {error}
            </div>
          ) : null}
          {!connection && !error ? (
            <div className="connection-loading" aria-live="polite">
              <span className="loading-spinner" />
              Preparing the installation credential…
            </div>
          ) : null}
          {connection ? (
            <div className="client-setup">
              <div className="client-picker" role="group" aria-label="Choose an MCP client">
                {clientSetups.map((client) => (
                  <button
                    type="button"
                    className={selectedClient === client.id ? "is-selected" : undefined}
                    aria-pressed={selectedClient === client.id}
                    onClick={() => {
                      setSelectedClient(client.id);
                      setCopiedClient(undefined);
                    }}
                    key={client.id}
                  >
                    <ClientIcon client={client.id} />
                    <strong>{client.name}</strong>
                  </button>
                ))}
              </div>

              <div className="client-instruction">
                <div>
                  <strong>{clientInstructions[selectedClient].title}</strong>
                  <span>{clientInstructions[selectedClient].label}</span>
                </div>
                <button type="button" className="client-copy-button" onClick={copySetup}>
                  {copiedClient === selectedClient
                    ? clientInstructions[selectedClient].copied
                    : clientInstructions[selectedClient].copyLabel}
                </button>
              </div>

              <div className="client-configuration">
                <pre>
                  <code>{setupPreview}</code>
                </pre>
                <span className="preview-caption">Credential hidden in preview</span>
              </div>
            </div>
          ) : null}
        </SettingsSection>
      </SettingsPageContent>
    </AppPageShell>
  );
}
