import { actions, useAppBridge, useAuthenticatedFetch } from "@saleor/app-sdk/app-bridge";
import type { AppPermission } from "@saleor/app-sdk/types";
import { useEffect, useMemo, useState } from "react";

import { permissionOptions } from "@/saleor-app/permissions";

type Connection = {
  saleorApiUrl: string;
  mcpUrl: string;
  mode: string;
  credential: string;
  config: Record<string, unknown>;
};

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

export default function DashboardPanel() {
  const { appBridge, appBridgeState } = useAppBridge();
  const authenticatedFetch = useAuthenticatedFetch();
  const [connection, setConnection] = useState<Connection>();
  const [error, setError] = useState<string>();
  const [copied, setCopied] = useState(false);
  const [selectedPermissions, setSelectedPermissions] = useState<Set<AppPermission>>(
    () => new Set(),
  );
  const [requestingPermissions, setRequestingPermissions] = useState(false);
  const canManageApps = appBridgeState?.user?.permissions.includes("MANAGE_APPS") ?? false;
  const appPermissions = appBridgeState?.appPermissions ?? [];
  const needsPermissions = appPermissions.length === 0;

  useEffect(() => {
    if (!appBridgeState?.ready || !canManageApps || needsPermissions) return;
    const controller = new AbortController();
    authenticatedFetch("/api/connection", { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok)
          throw new Error((await response.json()).error ?? "Could not create connection details.");
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
    setSelectedPermissions((current) => {
      const next = new Set(current);
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
    return (
      <main className="dashboard-shell">
        <section className="dashboard-card">Connecting to Saleor Dashboard…</section>
      </main>
    );
  }

  if (!canManageApps) {
    return (
      <main className="dashboard-shell">
        <section className="dashboard-card">
          <span className="eyebrow">Saleor MCP</span>
          <h1>Administrator access required</h1>
          <p>
            A staff member with Manage Apps permission must open this page to create the MCP
            connection.
          </p>
        </section>
      </main>
    );
  }

  if (needsPermissions) {
    const groups = ["Store operations", "Promotions", "Delivery and taxes", "Content"] as const;

    return (
      <main className="dashboard-shell">
        <section className="dashboard-card onboarding-card">
          <header className="onboarding-heading">
            <span className="eyebrow">Set up Saleor MCP</span>
            <h1>Choose what the MCP can access</h1>
            <p>
              Start with only the parts of Saleor you want to expose. This selection sets the
              maximum access of the app token.
            </p>
          </header>

          <div className="onboarding-step">
            <span>1</span>
            <div>
              <strong>Choose Saleor permissions</strong>
              <small>You can request more later.</small>
            </div>
          </div>

          <div className="permission-toolbar">
            <span>{selectedPermissions.size} selected</span>
            <div>
              <button
                type="button"
                className="text-button"
                onClick={() =>
                  setSelectedPermissions(new Set(permissionOptions.map(({ code }) => code)))
                }
              >
                Select all
              </button>
              <button
                type="button"
                className="text-button"
                onClick={() => setSelectedPermissions(new Set())}
              >
                Clear
              </button>
            </div>
          </div>

          <div className="permission-groups">
            {groups.map((group) => (
              <fieldset className="permission-group" key={group}>
                <legend>{group}</legend>
                {permissionOptions
                  .filter((option) => option.group === group)
                  .map((option) => (
                    <label className="permission-option" key={option.code}>
                      <input
                        type="checkbox"
                        checked={selectedPermissions.has(option.code)}
                        onChange={() => togglePermission(option.code)}
                      />
                      <span>
                        <strong>{option.label}</strong>
                        <small>{option.description}</small>
                      </span>
                    </label>
                  ))}
              </fieldset>
            ))}
          </div>

          {error ? <div className="inline-error">{error}</div> : null}

          <footer className="onboarding-actions">
            <p>Saleor will show the exact permission list for approval before anything changes.</p>
            <button
              type="button"
              className="primary-button"
              disabled={selectedPermissions.size === 0 || requestingPermissions}
              onClick={requestPermissions}
            >
              {requestingPermissions ? "Opening Saleor…" : "Review permissions in Saleor"}
            </button>
          </footer>
        </section>
      </main>
    );
  }

  return (
    <main className="dashboard-shell">
      <section className="dashboard-card connection-card">
        <header className="connection-heading">
          <div>
            <span className="eyebrow">Installed and ready</span>
            <h1>Connect your AI assistant</h1>
            <p>The app token stays on this server. Copy this configuration into your MCP client.</p>
          </div>
          <span className="mode-pill">{connection?.mode.replace("_", " ") ?? "loading"}</span>
        </header>

        {error ? <div className="inline-error">{error}</div> : null}
        {!connection && !error ? (
          <div className="config-loading">Preparing the installation credential…</div>
        ) : null}
        {connection ? (
          <>
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
              Treat this configuration like a password. It identifies this app installation and
              stops working when the installation is replaced or its app token changes.
            </p>
          </>
        ) : null}
      </section>
    </main>
  );
}
