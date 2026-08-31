#!/usr/bin/env node

import { readFile } from "node:fs/promises";

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

function usage(message) {
  if (message) console.error(message);
  console.error("Usage: probe.mjs --url <https-url> --token-env <ENV_NAME> --plan <plan.json>");
  process.exit(2);
}

function parseArgs(argv) {
  const values = {};
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index];
    const value = argv[index + 1];
    if (!key?.startsWith("--") || !value) usage(`Invalid argument near ${key ?? "<end>"}.`);
    values[key.slice(2)] = value;
  }
  for (const key of ["url", "token-env", "plan"]) {
    if (!values[key]) usage(`Missing --${key}.`);
  }
  return values;
}

function names(items) {
  return items.map((item) => item.name ?? item.uri).sort();
}

function sameMembers(actual, expected) {
  return JSON.stringify([...actual].sort()) === JSON.stringify([...expected].sort());
}

function assert(condition, message, failures) {
  if (!condition) failures.push(message);
}

const args = parseArgs(process.argv.slice(2));
const token = process.env[args["token-env"]];
if (!token) usage(`Environment variable ${args["token-env"]} is empty or unset.`);

const plan = JSON.parse(await readFile(args.plan, "utf8"));
const failures = [];
const client = new Client({ name: "saleor-mcp-probe", version: "1" }, { capabilities: {} });
const transport = new StreamableHTTPClientTransport(new URL(args.url), {
  requestInit: { headers: { Authorization: `Bearer ${token}` } },
});

const report = { server: null, tools: [], resources: [], prompts: [], calls: [] };

try {
  await client.connect(transport);
  report.server = client.getServerVersion();

  const toolResult = await client.listTools();
  report.tools = toolResult.tools.map(({ name, title, description, inputSchema, outputSchema, annotations }) => ({
    name,
    title,
    description,
    inputSchema,
    outputSchema,
    annotations,
  }));

  const resourceResult = await client.listResources();
  report.resources = resourceResult.resources;
  const promptResult = await client.listPrompts();
  report.prompts = promptResult.prompts;

  if (plan.expectTools) {
    assert(sameMembers(names(report.tools), plan.expectTools), "Tool list did not match the plan.", failures);
  }
  if (plan.expectResources) {
    assert(
      sameMembers(report.resources.map(({ uri }) => uri), plan.expectResources),
      "Resource list did not match the plan.",
      failures,
    );
  }
  if (plan.expectPrompts) {
    assert(sameMembers(names(report.prompts), plan.expectPrompts), "Prompt list did not match the plan.", failures);
  }

  for (const expected of plan.toolAnnotations ?? []) {
    const tool = report.tools.find(({ name }) => name === expected.name);
    assert(Boolean(tool), `Missing annotated tool ${expected.name}.`, failures);
    for (const [key, value] of Object.entries(expected.annotations ?? {})) {
      assert(tool?.annotations?.[key] === value, `${expected.name}.${key} did not match the plan.`, failures);
    }
  }

  for (const call of plan.calls ?? []) {
    const result = await client.callTool({ name: call.name, arguments: call.arguments ?? {} });
    report.calls.push({ label: call.label ?? call.name, name: call.name, result });
    if (typeof call.expectIsError === "boolean") {
      assert(Boolean(result.isError) === call.expectIsError, `${call.label ?? call.name} error state did not match the plan.`, failures);
    }
    if (call.expectTextIncludes) {
      const outputText = (result.content ?? [])
        .filter((item) => item.type === "text")
        .map((item) => item.text)
        .join("\n");
      for (const fragment of call.expectTextIncludes) {
        assert(outputText.includes(fragment), `${call.label ?? call.name} did not include expected text.`, failures);
      }
    }
  }
} catch (error) {
  failures.push(error instanceof Error ? error.message : String(error));
} finally {
  await client.close().catch(() => undefined);
}

report.failures = failures;
console.log(JSON.stringify(report, null, 2));
if (failures.length) process.exitCode = 1;
