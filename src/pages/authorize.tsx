import dynamic from "next/dynamic";
import Head from "next/head";

const AuthorizationPanel = dynamic(() => import("@/ui/authorization-panel"), { ssr: false });

export default function AuthorizePage() {
  return (
    <>
      <Head>
        <title>Authorize Saleor MCP</title>
      </Head>
      <AuthorizationPanel />
    </>
  );
}
