import { useAppBridge, useAuthenticatedFetch } from "@saleor/app-sdk/app-bridge";
import { useEffect, useMemo, useState } from "react";

type Connection = {
  saleorApiUrl: string;
  mcpUrl: string;
  mode: string;
  credential: string;
  config: Record<string, unknown>;
};

export default function DashboardPanel() {
  const { appBridgeState } = useAppBridge();
  const authenticatedFetch = useAuthenticatedFetch();
  const [connection, setConnection] = useState<Connection>();
  const [error, setError] = useState<string>();
  const [copied, setCopied] = useState(false);
  const canManageApps = appBridgeState?.user?.permissions.includes("MANAGE_APPS") ?? false;

  useEffect(() => {
    if (!appBridgeState?.ready || !canManageApps) return;
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
  }, [appBridgeState?.ready, authenticatedFetch, canManageApps]);

  useEffect(() => {
    document.documentElement.dataset.theme = appBridgeState?.theme ?? "light";
  }, [appBridgeState?.theme]);

  const configText = useMemo(
    () => (connection ? JSON.stringify(connection.config, null, 2) : ""),
    [connection],
  );

  const copyConfig = async () => {
    await navigator.clipboard.writeText(configText);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
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
