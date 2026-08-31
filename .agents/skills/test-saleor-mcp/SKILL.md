---
name: test-saleor-mcp
description: Test the hosted Saleor MCP as a real client and coding agent, including local app startup, a public tunnel, Dashboard installation, protocol discovery, safe live reads, mutation blocking, and detached-agent behavior. Use for end-to-end Saleor MCP checks; do not use as a substitute for the repository's unit and build checks.
---

# Test Saleor MCP

Prove the product in separate layers. A passing unit suite, a healthy HTTP endpoint, an MCP handshake, and a useful agent answer are different evidence.

## Inputs

Get these values from the user or the current session every time:

- repository root
- Saleor Dashboard URL
- local start command and selected free port
- public tunnel command or public base URL
- bearer-token environment variable name
- low-sensitivity read task for the agent
- output directory for temporary evidence

Never reuse a store URL, tunnel hostname, port, credential, token variable name, model, query, or expected store data from an earlier run. Do not put session values in this skill, committed files, shell history, process arguments, logs, or the final report.

## Test layers

1. **Repository gate:** inspect the current scripts and environment contract. Run the repository's own verification command when the user requests code-level confidence.
2. **Runtime gate:** start the app with session-only environment values on a confirmed free port. Start the requested tunnel and verify the local and public health endpoints plus the public manifest URLs.
3. **Installation gate:** use the user's authenticated Dashboard browser session. Install the public manifest only if the app is absent or clearly points at a stale deployment. Installing creates persistent access, so request confirmation immediately before the final install action. Never uninstall or reinstall merely to refresh a test.
4. **Protocol gate:** obtain the installed app's MCP configuration without printing its bearer credential. Run `scripts/probe.mjs` with the credential supplied through an environment variable. Verify initialization, server identity, the exact exposed surface, annotations, one low-sensitivity read, and the expected safe failure behavior.
5. **Agent gate:** run `scripts/run-detached-codex.sh` from a fresh empty working directory. Give it a plain user task, not tool-call instructions. Judge whether the agent discovers the server, calls `connection_info` first, introspects before guessing GraphQL, completes the task, explains GraphQL errors, and does not attempt a write.

Read [references/test-strategy.md](references/test-strategy.md) before the protocol or agent gate. It defines the evidence and stopping rules.

## Credential handling

Keep the installed configuration in the browser clipboard only long enough to start a probe. Extract the bearer value directly into the named environment variable in the same shell invocation; do not echo it or write it to a file. Clear or replace the clipboard after the test.

If browser tooling would expose the credential in its returned text, stop and choose a path that keeps it out of chat and tool output. Ask the user to export the credential locally when no safe automated transfer is available.

## Protocol probe

Create a session-only JSON plan outside the repository. Supply every expected tool, resource, prompt, and tool call explicitly; the probe has no Saleor URL, credential, query, or expected-data defaults.

```bash
node .agents/skills/test-saleor-mcp/scripts/probe.mjs \
  --url "$SALEOR_MCP_TEST_URL" \
  --token-env SALEOR_MCP_TEST_TOKEN \
  --plan "$SALEOR_MCP_TEST_PLAN"
```

The plan may include a mutation-shaped document only when it is intentionally side-effect-free or the expected result is policy rejection before Saleor receives it. Never use a live write as a connectivity check.

## Detached Codex harness

Use a new empty directory so the agent cannot inspect this repository or skill and reverse-engineer the answer. The wrapper uses ephemeral Codex state, ignores normal MCP configuration, passes only the named server, and leaves the user's persistent Codex configuration untouched.

```bash
.agents/skills/test-saleor-mcp/scripts/run-detached-codex.sh \
  --url "$SALEOR_MCP_TEST_URL" \
  --token-env SALEOR_MCP_TEST_TOKEN \
  --prompt-file "$SALEOR_MCP_TEST_PROMPT" \
  --workdir "$SALEOR_MCP_TEST_WORKDIR" \
  --output-dir "$SALEOR_MCP_TEST_OUTPUT"
```

Do not force a model unless the user names one. Do not disable approvals or sandboxing. Treat the protocol trace and the agent's final answer as separate artifacts.

## Report

Report each layer as `passed`, `failed`, or `not tested`, with the smallest useful evidence. State exactly where proof stopped. Do not call configuration alone a connection, a handshake a successful query, a direct probe an agent test, or a standalone page an embedded Dashboard test.
