import dynamic from "next/dynamic";
import Head from "next/head";

const DashboardPanel = dynamic(() => import("@/ui/dashboard-panel"), {
  ssr: false,
  loading: () => (
    <main className="configuration-shell">
      <section className="configuration-loading">Connecting to Saleor Dashboard…</section>
    </main>
  ),
});

export default function DashboardPage() {
  return (
    <>
      <Head>
        <title>Configure Saleor MCP</title>
      </Head>
      <DashboardPanel />
    </>
  );
}
