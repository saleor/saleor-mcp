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
  mode: string;
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

function OnboardingStatus({
  permissionsComplete = false,
  onOpenPermissions,
}: {
  permissionsComplete?: boolean;
  onOpenPermissions?: () => void;
}) {
  return (
    <AsideInfoCard title="Onboarding status">
      <ol className="onboarding-steps">
        <li
          className={permissionsComplete ? "is-complete" : "is-active"}
          aria-current={permissionsComplete ? undefined : "step"}
        >
          <button
            type="button"
            className="onboarding-step-content"
            disabled={!permissionsComplete || !onOpenPermissions}
            onClick={onOpenPermissions}
          >
            <span className="onboarding-step-number" aria-hidden="true">
              {permissionsComplete ? <CheckIcon /> : "1"}
            </span>
            <span>
              <strong>Choose Saleor permissions</strong>
              <p>Set the maximum Saleor access available to this installation.</p>
            </span>
          </button>
        </li>
        <li
          className={permissionsComplete ? "is-active" : "is-disabled"}
          aria-current={permissionsComplete ? "step" : undefined}
        >
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

function PermissionControls({
  selectedPermissions,
  requestingPermissions,
  error,
  onSelectAll,
  onClear,
  onTogglePermission,
  onRequestPermissions,
}: {
  selectedPermissions: Set<AppPermission>;
  requestingPermissions: boolean;
  error?: string;
  onSelectAll: () => void;
  onClear: () => void;
  onTogglePermission: (permission: AppPermission) => void;
  onRequestPermissions: () => void;
}) {
  return (
    <>
      <div className="permission-toolbar">
        <p>Select the Saleor permissions this MCP configuration needs.</p>
        <div>
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
                  <code className="permission-code">{option.code}</code>
                </label>
              ))}
          </fieldset>
        ))}
      </div>

      {error ? (
        <div className="inline-error" role="alert">
          {error}
        </div>
      ) : null}

      <footer className="section-footer">
        <p>Saleor shows the exact permission list for approval before anything changes.</p>
        <button
          type="button"
          className="app-button app-button-primary"
          disabled={selectedPermissions.size === 0 || requestingPermissions}
          onClick={onRequestPermissions}
        >
          {requestingPermissions ? "Opening Saleor…" : "Review permissions in Saleor"}
        </button>
      </footer>
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
    if (!appBridge || selectedPermissions.size === 0) return;
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
          description="Choose the Saleor permissions available through this MCP configuration. You can request more later."
          aside={<OnboardingStatus />}
        >
          <SettingsSection
            title="Saleor permissions"
            description="These permissions are the ceiling for MCP access. A user's own Saleor permissions cannot increase it."
            headerEnd={<span className="count-badge">{selectedPermissions.size} selected</span>}
          >
            <PermissionControls
              selectedPermissions={selectedPermissions}
              requestingPermissions={requestingPermissions}
              error={error}
              onSelectAll={() =>
                setPermissionSelection(new Set(permissionOptions.map(({ code }) => code)))
              }
              onClear={() => setPermissionSelection(new Set())}
              onTogglePermission={togglePermission}
              onRequestPermissions={() => void requestPermissions()}
            />
          </SettingsSection>
        </SettingsPageContent>
      </AppPageShell>
    );
  }

  const modeLabel = connection?.mode.replaceAll("_", " ") ?? "Loading";

  return (
    <AppPageShell onOpenDocumentation={() => void openDocumentation()}>
      <SettingsPageContent
        description="Connect an AI assistant to this Saleor environment. The connection is tied to this app installation."
        aside={
          <OnboardingStatus
            permissionsComplete
            onOpenPermissions={() => setPermissionsExpanded(true)}
          />
        }
      >
        <CollapsibleSettingsSection
          title="Saleor permissions"
          count={`${appPermissions?.length ?? 0} granted`}
          expanded={permissionsExpanded}
          onToggle={() => setPermissionsExpanded((current) => !current)}
        >
          <PermissionControls
            selectedPermissions={selectedPermissions}
            requestingPermissions={requestingPermissions}
            error={permissionsExpanded ? error : undefined}
            onSelectAll={() =>
              setPermissionSelection(new Set(permissionOptions.map(({ code }) => code)))
            }
            onClear={() => setPermissionSelection(new Set())}
            onTogglePermission={togglePermission}
            onRequestPermissions={() => void requestPermissions()}
          />
        </CollapsibleSettingsSection>
        <SettingsSection
          title="MCP connection"
          description="Use this configuration in a client that supports Streamable HTTP."
          headerEnd={<span className="mode-badge">{modeLabel}</span>}
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
