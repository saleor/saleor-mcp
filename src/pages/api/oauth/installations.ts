import { createProtectedHandler } from "@saleor/app-sdk/handlers/next";

import { normalizeDashboardOrigin } from "@/oauth/config";
import { registerInstallation } from "@/oauth/installations";
import { getOAuthStore } from "@/oauth/store";
import { saleorApp } from "@/saleor-app";

export default createProtectedHandler(
  async (request, response, context) => {
    if (request.method !== "POST") {
      response.setHeader("Allow", "POST");
      return response.status(405).json({ error: "Method not allowed" });
    }
    const rawDashboardOrigin =
      typeof request.body?.dashboardOrigin === "string"
        ? request.body.dashboardOrigin
        : process.env.SALEOR_DASHBOARD_ORIGIN;
    if (!rawDashboardOrigin) {
      return response.status(400).json({ error: "dashboardOrigin is required" });
    }
    try {
      const dashboardOrigin = normalizeDashboardOrigin(rawDashboardOrigin);
      const installationId = await registerInstallation(
        context.authData,
        dashboardOrigin,
        getOAuthStore(),
      );
      return response.status(200).json({ installationId });
    } catch (error) {
      return response.status(400).json({
        error: error instanceof Error ? error.message : "Invalid Dashboard origin",
      });
    }
  },
  saleorApp.apl,
  ["MANAGE_APPS"],
);
