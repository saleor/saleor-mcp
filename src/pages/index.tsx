import Head from "next/head";

import packageJson from "../../package.json";

const tools = [
  {
    id: "connection_info",
    name: "Connection Info",
    description:
      "Reports the connected Saleor instance, the app's permissions, and the active safety policy. Call this first.",
    arguments: [],
  },
  {
    id: "introspect_schema",
    name: "Introspect Schema",
    description:
      "Explores the Saleor GraphQL schema in focused slices before you compose a query or mutation.",
    arguments: ["action (required)", "name", "kind", "search"],
  },
  {
    id: "run_query",
    name: "Run GraphQL Query",
    description:
      "Executes read-only GraphQL and returns Saleor's raw data and errors. Mutation documents are rejected.",
    arguments: ["query (required)", "variables", "operation_name"],
  },
  {
    id: "run_mutation",
    name: "Run GraphQL Mutation",
    description:
      "Executes GraphQL writes when the deployment policy allows them. Read-write mode permits only explicitly allowlisted mutations.",
    arguments: ["query (required)", "variables", "operation_name"],
  },
];

function Logo() {
  return (
    <svg className="brand-mark" viewBox="0 0 42 42" aria-hidden="true">
      <path d="M21 3 36.6 12v18L21 39 5.4 30V12L21 3Z" fill="#fff" />
      <path d="m21 9.5 10 5.8v11.5l-10 5.7-10-5.7V15.3l10-5.8Z" fill="#101418" />
      <path d="m21 15 5.2 3v6L21 27l-5.2-3v-6l5.2-3Z" fill="#25c18a" />
    </svg>
  );
}

export default function HomePage() {
  return (
    <>
      <Head>
        <title>Saleor MCP Server</title>
        <meta
          name="description"
          content="Connect Saleor Commerce to AI assistants through the Model Context Protocol."
        />
        <link rel="icon" href="/favicon.svg" />
      </Head>
      <main className="landing-shell">
        <header className="hero">
          <div className="brand-lockup">
            <Logo />
            <h1>Saleor MCP Server</h1>
          </div>
          <p>A Model Context Protocol implementation for interacting with Saleor Commerce</p>
        </header>

        <section className="landing-card">
          <header className="card-heading">
            <span className="section-icon" aria-hidden="true">
              ⌁
            </span>
            <div>
              <h2>Welcome to Saleor MCP</h2>
              <p>Query and operate your Saleor store from your AI assistant</p>
            </div>
          </header>
          <div className="card-body">
            <p>
              This server gives AI assistants a small set of generic tools for exploring
              Saleor&apos;s GraphQL schema, reading store data, and making allowed changes. The
              assistant composes GraphQL for you instead of relying on a fixed catalogue of actions.
            </p>
            <div className="prompt-box">
              <p>Use it for questions and tasks like:</p>
              <ul>
                <li>Which products are running low on stock?</li>
                <li>Show recent orders that need attention.</li>
                <li>Update product data across a catalogue.</li>
              </ul>
            </div>
            <p>
              What it can do is bounded by the permissions granted during app installation and by
              the server&apos;s safety policy.
            </p>
          </div>
        </section>

        <section className="landing-card">
          <header className="card-heading">
            <span className="section-icon" aria-hidden="true">
              ↗
            </span>
            <div>
              <h2>Getting started</h2>
              <p>Install the app, then copy the connection from Saleor Dashboard</p>
            </div>
          </header>
          <div className="card-body">
            <ol className="steps">
              <li>
                <span>1</span>
                <p>
                  Deploy this app and install its <code>/api/manifest</code> URL in Saleor
                  Dashboard.
                </p>
              </li>
              <li>
                <span>2</span>
                <p>Open Saleor MCP from the Dashboard Apps section.</p>
              </li>
              <li>
                <span>3</span>
                <p>
                  Copy the generated MCP configuration into Claude Code, Cursor, VS Code, or another
                  HTTP MCP client.
                </p>
              </li>
            </ol>
            <a
              className="primary-link"
              href="https://github.com/saleor/saleor-mcp"
              target="_blank"
              rel="noreferrer"
            >
              View the repository <span aria-hidden="true">↗</span>
            </a>
            <div className="note-box">
              The Saleor app token stays server-side. Users approve access in their Saleor
              Dashboard, and MCP clients receive a separate short-lived OAuth token.
            </div>
          </div>
        </section>

        <section className="landing-card">
          <header className="card-heading">
            <span className="section-icon" aria-hidden="true">
              ϟ
            </span>
            <div>
              <h2>Available tools</h2>
              <p>Generic tools for operating the Saleor GraphQL API</p>
            </div>
          </header>
          <div className="card-body">
            <p>
              Schema discovery, reads, and writes stay separate so the assistant can inspect the
              exact API before acting.
            </p>
            <div className="tool-list">
              {tools.map((tool) => (
                <details className="tool-row" key={tool.id}>
                  <summary>
                    <span className="tool-id">{tool.id}</span>
                    <span>{tool.name}</span>
                    <span className="disclosure">⌄</span>
                  </summary>
                  <div className="tool-details">
                    <p>{tool.description}</p>
                    {tool.arguments.length ? (
                      <>
                        <h3>Arguments</h3>
                        <ul>
                          {tool.arguments.map((argument) => (
                            <li key={argument}>
                              <code>{argument}</code>
                            </li>
                          ))}
                        </ul>
                      </>
                    ) : (
                      <em>No additional arguments required</em>
                    )}
                  </div>
                </details>
              ))}
            </div>
          </div>
        </section>

        <footer className="landing-footer">
          <p>
            Built by{" "}
            <a href="https://saleor.io" target="_blank" rel="noreferrer">
              Saleor Commerce
            </a>
            .
          </p>
          <p>Version {packageJson.version}</p>
        </footer>
      </main>
    </>
  );
}
