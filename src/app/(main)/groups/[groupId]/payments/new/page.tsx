"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect } from "react";
import AddPaymentForm from "@/components/features/add_payment/AddPaymentForm";
import BackButton from "@/components/ui/BackButton";
import { useGroup } from "@/contexts/GroupContext";

export default function NewPaymentPage() {
  const params = useParams<{ groupId: string }>();
  const router = useRouter();
  const { snapshot, groupStatus, syncStatus, lastError, loadGroup, addPayment } =
    useGroup();

  useEffect(() => {
    if (snapshot?.group.id !== params.groupId) {
      void loadGroup(params.groupId);
    }
  }, [loadGroup, params.groupId, snapshot?.group.id]);

  if (!snapshot || snapshot.group.id !== params.groupId) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-blue-100 to-blue-400 p-6 text-center text-blue-800 font-bold">
        {groupStatus === "error"
          ? lastError ?? "グループを開けません。"
          : "グループを読み込んでいます..."}
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-blue-100 to-blue-400 p-6">
      <BackButton
        className="self-start"
        onClick={() => router.replace(`/groups/${params.groupId}`)}
      />
      <div className="w-full max-w-xl mx-auto">
        <AddPaymentForm
          members={snapshot.members}
          disabled={syncStatus === "offline"}
          onSubmit={async (input) => {
            const result = await addPayment(input);
            if (result.ok) {
              router.replace(`/groups/${params.groupId}`);
            }
            return result;
          }}
        />
      </div>
    </main>
  );
}
