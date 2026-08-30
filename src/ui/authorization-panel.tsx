import { useAppBridge, useAuthenticatedFetch } from "@saleor/app-sdk/app-bridge";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";

type Consent = {
  clientName: string;
  clientId: string;
  redirectHost: string;
  requestedScopes: string[];
  grantableScopes: string[];
  userEmail: string;
  expiresAt: number;
};

export default function AuthorizationPanel() {
  const router = useRouter();
  const { appBridgeState } = useAppBridge();
  const authenticatedFetch = useAuthenticatedFetch();
  const requestId = typeof router.query.request === "string" ? router.query.request : undefined;
  const [consent, setConsent] = useState<Consent>();
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [redirectTo, setRedirectTo] = useState<string>();

  useEffect(() => {
    if (!appBridgeState?.ready || !requestId) return;
    const controller = new AbortController();
    authenticatedFetch(`/api/oauth/consent?request=${encodeURIComponent(requestId)}`, {
      signal: controller.signal,
    })
      .then(async (response) => {
        const body = (await response.json()) as Consent & { error?: string };
        if (!response.ok) throw new Error(body.error ?? "Could not load authorization request.");
        return body;
      })
      .then(setConsent)
      .catch((reason: unknown) => {
        if (!controller.signal.aborted)
          setError(reason instanceof Error ? reason.message : String(reason));
      });
    return () => controller.abort();
  }, [appBridgeState?.ready, authenticatedFetch, requestId]);

  useEffect(() => {
    document.documentElement.dataset.theme = appBridgeState?.theme ?? "light";
  }, [appBridgeState?.theme]);

  async function decide(decision: "allow" | "deny") {
    if (!requestId) return;
    setBusy(true);
    setError(undefined);
    try {
      const response = await authenticatedFetch("/api/oauth/consent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ request: requestId, decision }),
      });
      const body = (await response.json()) as { error?: string; redirectTo?: string };
      if (!response.ok || !body.redirectTo) {
        throw new Error(body.error ?? "Could not complete authorization.");
      }
      setRedirectTo(body.redirectTo);
      window.top?.location.assign(body.redirectTo);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
      setBusy(false);
    }
  }

  if (!appBridgeState?.ready || (!consent && !error)) {
    return (
      <main className="dashboard-shell">
        <section className="dashboard-card">Loading authorization request…</section>
      </main>
    );
  }

  return (
    <main className="dashboard-shell">
      <section className="dashboard-card authorization-card">
        <span className="eyebrow">Saleor MCP authorization</span>
        <h1>Authorize {consent?.clientName ?? "this client"}?</h1>
        {consent ? (
          <>
            <p>
              Signed in as <strong>{consent.userEmail}</strong>. After approval, the client can act
              on this Saleor instance within the permissions below.
            </p>
            <div className="authorization-facts">
              <div>
                <span>Client</span>
                <code>{consent.clientId}</code>
              </div>
              <div>
                <span>Returns to</span>
                <code>{consent.redirectHost}</code>
              </div>
            </div>
            <h2>Access requested</h2>
            {consent.grantableScopes.length ? (
              <ul className="scope-list">
                {consent.grantableScopes.map((scope) => (
                  <li key={scope}>{scope}</li>
                ))}
              </ul>
            ) : (
              <p className="muted-copy">No additional MCP scopes are grantable.</p>
            )}
            {consent.grantableScopes.length < consent.requestedScopes.length ? (
              <p className="permission-warning">
                Some requested access was removed because your Saleor permissions do not allow it.
              </p>
            ) : null}
            <p className="credential-note">
              Saleor MCP will mint a separate, short-lived token. Your Dashboard login token is
              never sent to the client.
            </p>
            <div className="authorization-actions">
              <button
                type="button"
                className="secondary-button"
                disabled={busy}
                onClick={() => decide("deny")}
              >
                Deny
              </button>
              <button
                type="button"
                className="primary-button"
                disabled={busy}
                onClick={() => decide("allow")}
              >
                {busy ? "Authorizing…" : "Authorize"}
              </button>
            </div>
          </>
        ) : null}
        {error ? <div className="inline-error">{error}</div> : null}
        {redirectTo ? (
          <p>
            <a href={redirectTo} target="_top">
              Return to the MCP client
            </a>
          </p>
        ) : null}
      </section>
    </main>
  );
}
