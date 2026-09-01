import { actions, useAppBridge, useAuthenticatedFetch } from "@saleor/app-sdk/app-bridge";
import type { AppPermission } from "@saleor/app-sdk/types";
import { useEffect, useMemo, useState } from "react";

import { permissionOptions } from "@/saleor-app/permissions";

import {
  AppPageShell,
  AsideInfoCard,
  DashboardLoading,
  SettingsPageContent,
  SettingsSection,
} from "./app-page-shell";

const DOCUMENTATION_URL = "https://github.com/saleor/saleor-mcp";

type Connection = {
  saleorApiUrl: string;
  mcpUrl: string;
  config: Record<string, unknown>;
};

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
    <AsideInfoCard title="Configuration">
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
          <dt>Access areas</dt>
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
  showAccessAreasTitle = false,
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
  showAccessAreasTitle?: boolean;
  showDescription?: boolean;
}) {
  return (
    <>
      <div className="permission-toolbar">
        {showAccessAreasTitle || showDescription ? (
          <div className="permission-toolbar-copy">
            {showAccessAreasTitle ? (
              <strong className="permission-subtitle">Access areas</strong>
            ) : null}
            {showDescription ? (
              <p>Select the parts of Saleor the agent should be able to access.</p>
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
  const [copied, setCopied] = useState(false);
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

  const configText = useMemo(
    () => (connection ? JSON.stringify(connection.config, null, 2) : ""),
    [connection],
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

  const copyConfig = async () => {
    try {
      await copyText(configText);
      setError(undefined);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setError("Could not copy the configuration. Select the text and copy it manually.");
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
      <AppPageShell onOpenDocumentation={() => void openDocumentation()}>
        <SettingsPageContent
          description="Connect an AI assistant to this Saleor environment. The connection is tied to this app installation."
          aside={<OnboardingStatus />}
        >
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
      <AppPageShell onOpenDocumentation={() => void openDocumentation()}>
        <SettingsPageContent
          description="Choose what the MCP may do and which parts of Saleor it may access."
          aside={<OnboardingStatus />}
        >
          <SettingsSection
            title="Permissions"
            description="These permissions apply to every assistant using this MCP connection."
            headerEnd={<span className="count-badge">{selectedPermissions.size} selected</span>}
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
              showAccessAreasTitle
            />
          </SettingsSection>
        </SettingsPageContent>
      </AppPageShell>
    );
  }

  return (
    <AppPageShell
      description="Connect an AI assistant to this Saleor environment. The connection is tied to this app installation."
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
              <strong>Access areas</strong>
              <span>Select the parts of Saleor the agent should be able to access.</span>
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
          description="Use this configuration in a client that supports Streamable HTTP."
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
            <>
              <div className="connection-ready">
                <span className="ready-icon">
                  <CheckIcon />
                </span>
                <div>
                  <strong>Ready to connect</strong>
                  <p>The endpoint and credential were created for this Saleor installation.</p>
                </div>
              </div>

              <dl className="connection-facts">
                <div>
                  <dt>Saleor API</dt>
                  <dd title={connection.saleorApiUrl}>{connection.saleorApiUrl}</dd>
                </div>
                <div>
                  <dt>MCP endpoint</dt>
                  <dd title={connection.mcpUrl}>{connection.mcpUrl}</dd>
                </div>
              </dl>

              <div className="client-configuration">
                <div className="code-toolbar">
                  <span>Client configuration</span>
                  <div>
                    <span>JSON</span>
                    <button type="button" className="code-copy-button" onClick={copyConfig}>
                      {copied ? "Copied" : "Copy configuration"}
                    </button>
                  </div>
                </div>
                <pre>
                  <code>{configText}</code>
                </pre>
              </div>

              <div className="credential-notice">
                <ShieldIcon />
                <p>
                  <strong>Keep this configuration private.</strong> It identifies this installation
                  and must be copied again if the installation is replaced or reconnected.
                </p>
              </div>
            </>
          ) : null}
        </SettingsSection>
      </SettingsPageContent>
    </AppPageShell>
  );
}
