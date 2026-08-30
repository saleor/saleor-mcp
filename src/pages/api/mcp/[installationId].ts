import type { NextApiRequest, NextApiResponse } from "next";

import { handleMcpRequest } from "../mcp";

export default async function handler(request: NextApiRequest, response: NextApiResponse) {
  const installationId = Array.isArray(request.query.installationId)
    ? request.query.installationId[0]
    : request.query.installationId;
  if (!installationId || !/^[A-Za-z0-9_-]{32}$/.test(installationId)) {
    return response.status(404).json({ error: "Unknown MCP installation." });
  }
  return handleMcpRequest(request, response, installationId);
}
