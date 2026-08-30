import type { AuthData } from "@saleor/app-sdk/APL";

import { deriveInstallationId } from "./config";
import type { OAuthStore } from "./store";
import { saleorApp } from "../saleor-app";

export async function registerInstallation(
  authData: AuthData,
  dashboardOrigin: string,
  store: OAuthStore,
) {
  const installationId = deriveInstallationId(authData);
  await store.putInstallation({
    installationId,
    saleorApiUrl: authData.saleorApiUrl,
    appId: authData.appId,
    dashboardOrigin,
    updatedAt: Date.now(),
  });
  return installationId;
}

export async function resolveInstallation(installationId: string, store: OAuthStore) {
  if (!/^[A-Za-z0-9_-]{32}$/.test(installationId)) return undefined;
  const settings = await store.getInstallation(installationId);
  if (!settings) return undefined;
  const authData = await saleorApp.apl.get(settings.saleorApiUrl);
  if (
    !authData ||
    authData.appId !== settings.appId ||
    deriveInstallationId(authData) !== installationId
  ) {
    return undefined;
  }
  return { settings, authData };
}
