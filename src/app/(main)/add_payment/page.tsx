"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import PageShell from "@/components/ui/PageShell";
import StatusPanel from "@/components/ui/StatusPanel";

export default function LegacyAddPaymentRoute() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/");
  }, [router]);
  return (
    <PageShell centered>
      <StatusPanel loading message="ホームへ移動しています..." />
    </PageShell>
  );
}
