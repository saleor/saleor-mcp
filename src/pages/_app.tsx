import "@/styles/globals.css";

import { AppBridge, AppBridgeProvider } from "@saleor/app-sdk/app-bridge";
import { RoutePropagator } from "@saleor/app-sdk/app-bridge/next";
import type { AppProps } from "next/app";

const appBridgeInstance = typeof window === "undefined" ? undefined : new AppBridge();

export default function App({ Component, pageProps }: AppProps) {
  return (
    <AppBridgeProvider appBridgeInstance={appBridgeInstance}>
      <RoutePropagator />
      <Component {...pageProps} />
    </AppBridgeProvider>
  );
}
