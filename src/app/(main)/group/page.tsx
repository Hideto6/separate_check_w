"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function LegacyGroupRoute() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/");
  }, [router]);
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-blue-100 to-blue-400 text-blue-800 font-bold">
      ホームへ移動しています...
    </div>
  );
}
