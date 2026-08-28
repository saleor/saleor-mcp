import dynamic from "next/dynamic";
import Head from "next/head";

const DashboardPanel = dynamic(() => import("@/ui/dashboard-panel"), {
  ssr: false,
  loading: () => (
    <main className="dashboard-shell">
      <section className="dashboard-card">Connecting to Saleor Dashboard…</section>
    </main>
  ),
});

export default function DashboardPage() {
  return (
    <>
      <Head>
        <title>Connect Saleor MCP</title>
      </Head>
      <DashboardPanel />
    </>
  );
}
