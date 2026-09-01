import dynamic from "next/dynamic";
import Head from "next/head";

import { DashboardLoading } from "@/ui/app-page-shell";

const DashboardPanel = dynamic(() => import("@/ui/dashboard-panel"), {
  ssr: false,
  loading: () => <DashboardLoading />,
});

export default function DashboardPage() {
  return (
    <>
      <Head>
        <title>Saleor MCP configuration</title>
        <link rel="icon" href="/saleor-mcp-icon.png" type="image/png" />
      </Head>
      <DashboardPanel />
    </>
  );
}
