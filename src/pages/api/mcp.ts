import { NodeStreamableHTTPServerTransport } from "@modelcontextprotocol/node";
import type { NextApiRequest, NextApiResponse } from "next";

import { authenticateMcpRequest, McpAuthenticationError } from "@/mcp/authenticate";
import { createMcpServer } from "@/mcp/server";

export default async function handler(request: NextApiRequest, response: NextApiResponse) {
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    return response.status(405).json({
      jsonrpc: "2.0",
      error: { code: -32000, message: "Method not allowed." },
      id: null,
    });
  }

  let authData;
  try {
    authData = await authenticateMcpRequest(request.headers.authorization);
  } catch (error) {
    const unauthorized = error instanceof McpAuthenticationError;
    if (!unauthorized) console.error("Failed to authenticate MCP request", error);
    return response.status(unauthorized ? 401 : 500).json({
      jsonrpc: "2.0",
      error: {
        code: unauthorized ? -32001 : -32603,
        message: unauthorized ? error.message : "Internal server error",
      },
      id: null,
    });
  }

  const server = createMcpServer(authData);
  const transport = new NodeStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });

  response.on("close", () => {
    void transport.close();
    void server.close();
  });

  try {
    await server.connect(transport);
    await transport.handleRequest(request, response, request.body);
  } catch (error) {
    console.error("Failed to handle MCP request", error);
    if (!response.headersSent) {
      response.status(500).json({
        jsonrpc: "2.0",
        error: { code: -32603, message: "Internal server error" },
        id: null,
      });
    }
  }
}
