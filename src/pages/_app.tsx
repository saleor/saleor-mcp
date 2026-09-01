import "@/styles/globals.css";

import { actions, AppBridge, AppBridgeProvider, useAppBridge } from "@saleor/app-sdk/app-bridge";
import { RoutePropagator } from "@saleor/app-sdk/app-bridge/next";
import dynamic from "next/dynamic";
import type { AppProps } from "next/app";
import { Fragment, type PropsWithChildren, useEffect, useRef } from "react";

const ClientOnly = ({ children }: PropsWithChildren) => <Fragment>{children}</Fragment>;
const NoSSRWrapper = dynamic(() => Promise.resolve(ClientOnly), { ssr: false });

// Wait until React has subscribed to App Bridge events before asking Dashboard for the handshake.
const appBridgeInstance =
  typeof window === "undefined" ? undefined : new AppBridge({ autoNotifyReady: false });

function AppBridgeHandshake() {
  const { appBridge } = useAppBridge();
  const notificationStarted = useRef(false);

  useEffect(() => {
    if (!appBridge || notificationStarted.current) return;

    notificationStarted.current = true;
    void appBridge.dispatch(actions.NotifyReady()).catch((error: unknown) => {
      console.error("App Bridge handshake failed", error);
    });
  }, [appBridge]);

  return null;
}

export default function App({ Component, pageProps }: AppProps) {
  return (
    <NoSSRWrapper>
      <AppBridgeProvider appBridgeInstance={appBridgeInstance}>
        <RoutePropagator />
        <Component {...pageProps} />
        <AppBridgeHandshake />
      </AppBridgeProvider>
    </NoSSRWrapper>
  );
}
