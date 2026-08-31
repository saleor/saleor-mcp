# Test strategy

## Why two clients

Use both a direct protocol client and a detached coding agent.

- The direct client makes protocol failures easy to locate: transport, authentication, initialization, discovery, schema metadata, tool execution, or error shape.
- The detached agent tests the actual product question: whether a new coding agent understands when and how to use the MCP without being coached through individual calls.

MCP Inspector is useful for manual debugging, but it does not replace the agent test. The official MCP guidance describes Inspector as a way to list and call server features directly. OpenAI's MCP documentation says Codex supports Streamable HTTP servers, bearer tokens, tool allow lists, and write-aware approval modes.

Primary references:

- https://modelcontextprotocol.io/docs/tools/inspector
- https://modelcontextprotocol.io/specification/2025-11-25/server/tools
- https://learn.chatgpt.com/docs/extend/mcp
- https://developers.openai.com/api/docs/guides/tools-connectors-mcp

## Required protocol evidence

Capture:

- successful public health and manifest requests
- manifest `appUrl` and `tokenTargetUrl` on the public origin
- successful MCP initialization and reported server name/version
- exact tool, resource, and prompt names
- input schemas and tool annotations
- `connection_info` result with secrets and personal fields redacted from any durable artifact
- schema discovery before a GraphQL query is composed
- one low-sensitivity query result whose expected facts were supplied for this run
- one policy rejection that cannot change Saleor data
- actionable behavior for invalid input or GraphQL errors

The current product contract can be asserted by a session plan, but the script itself must stay server-neutral and contain no expected tool list.

## Agent task design

The prompt should sound like a real end-user request. Ask for a small fact available from the selected Saleor instance. Do not mention tool names, GraphQL syntax, schema introspection, or the expected answer.

Use one run for the main acceptance check. Retry only for a clearly transient transport or provider failure, and record the retry. Do not keep rephrasing until the agent passes.

Judge the full trace and final answer separately:

- Did the MCP initialize?
- Did the agent select it without being told which tool to call?
- Did it inspect connection and safety state?
- Did it discover the live schema before composing uncertain GraphQL?
- Did it recover from actionable tool or GraphQL errors without looping?
- Is the final answer correct, concise, and grounded in returned data?
- Did it avoid writes and avoid exposing credentials?

## Stopping rules

Stop and report the boundary when:

- the browser or computer-control session is unavailable for installation
- authentication cannot be completed without exposing a credential
- the manifest requests permissions that the user did not expect
- the public manifest points to localhost or a different origin
- the app is not in read-only mode for a read-only acceptance run
- a test would require changing live commerce data
- the same transport or provider error repeats twice

Do not weaken safety settings to make a test pass.
