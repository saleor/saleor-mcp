import type { AuthData } from "@saleor/app-sdk/APL";
import { createProtectedHandler } from "@saleor/app-sdk/handlers/next";
import type { NextApiRequest, NextApiResponse } from "next";

import {
  loadPolicyConfigState,
  PolicyConfigPersistenceError,
  savePolicyConfig,
} from "@/mcp/config-repository";
import {
  parsePolicyConfigInput,
  PolicyConfigValidationError,
  serializePolicyConfig,
} from "@/mcp/config";
import { saleorApp } from "@/saleor-app";

type SettingsDependencies = {
  load: typeof loadPolicyConfigState;
  save: typeof savePolicyConfig;
};

const dependencies: SettingsDependencies = {
  load: loadPolicyConfigState,
  save: savePolicyConfig,
};

export async function handleSettingsRequest(
  request: NextApiRequest,
  response: NextApiResponse,
  authData: AuthData,
  deps: SettingsDependencies = dependencies,
) {
  if (request.method === "GET") {
    try {
      const state = await deps.load(authData);
      return response.status(200).json({
        policy: serializePolicyConfig(state.policy),
        source: state.source,
        ...(state.warning ? { warning: state.warning } : {}),
      });
    } catch (error) {
      if (!(error instanceof PolicyConfigPersistenceError)) {
        console.error("Unexpected error while loading MCP permission settings", error);
      }
      return response.status(502).json({
        error:
          error instanceof PolicyConfigPersistenceError
            ? error.message
            : "Could not load permission settings from Saleor.",
      });
    }
  }

  if (request.method === "PUT") {
    let policy;
    try {
      policy = parsePolicyConfigInput(request.body);
    } catch (error) {
      if (!(error instanceof PolicyConfigValidationError)) {
        console.error("Unexpected error while validating MCP permission settings", error);
      }
      return response.status(400).json({
        error:
          error instanceof PolicyConfigValidationError
            ? error.message
            : "Invalid permission configuration.",
      });
    }

    try {
      const savedPolicy = await deps.save(authData, policy);
      return response.status(200).json({ policy: savedPolicy, source: "private_metadata" });
    } catch (error) {
      if (!(error instanceof PolicyConfigPersistenceError)) {
        console.error("Unexpected error while saving MCP permission settings", error);
      }
      return response.status(502).json({
        error:
          error instanceof PolicyConfigPersistenceError
            ? error.message
            : "Could not save permission settings to Saleor.",
      });
    }
  }

  response.setHeader("Allow", "GET, PUT");
  return response.status(405).json({ error: "Method not allowed" });
}

export default createProtectedHandler(
  (request, response, context) =>
    handleSettingsRequest(request, response, context.authData, dependencies),
  saleorApp.apl,
  ["MANAGE_APPS"],
);
