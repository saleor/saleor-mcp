import "@/styles/globals.css";

import { AppBridge, AppBridgeProvider } from "@saleor/app-sdk/app-bridge";
import { RoutePropagator } from "@saleor/app-sdk/app-bridge/next";
import dynamic from "next/dynamic";
import type { AppProps } from "next/app";
import { Fragment, type PropsWithChildren } from "react";

const ClientOnly = ({ children }: PropsWithChildren) => <Fragment>{children}</Fragment>;
const NoSSRWrapper = dynamic(() => Promise.resolve(ClientOnly), { ssr: false });

const appBridgeInstance = typeof window === "undefined" ? undefined : new AppBridge();

export default function App({ Component, pageProps }: AppProps) {
  return (
    <NoSSRWrapper>
      <AppBridgeProvider appBridgeInstance={appBridgeInstance}>
        <RoutePropagator />
        <Component {...pageProps} />
      </AppBridgeProvider>
    </NoSSRWrapper>
  );
}
