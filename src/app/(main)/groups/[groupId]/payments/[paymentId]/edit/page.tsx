"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect } from "react";
import AddPaymentForm from "@/components/features/add_payment/AddPaymentForm";
import BackButton from "@/components/ui/BackButton";
import { useGroup } from "@/contexts/GroupContext";

export default function EditPaymentPage() {
  const params = useParams<{ groupId: string; paymentId: string }>();
  const router = useRouter();
  const {
    snapshot,
    groupStatus,
    syncStatus,
    lastError,
    loadGroup,
    updatePayment,
  } = useGroup();

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

  const payment = snapshot.payments.find(
    (candidate) => candidate.id === params.paymentId
  );
  if (!payment) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-blue-100 to-blue-400 p-6 text-center">
        <p className="font-bold text-red-600 mb-4">
          支払い記録が見つかりません。ほかの参加者が削除した可能性があります。
        </p>
        <button
          type="button"
          onClick={() => router.replace(`/groups/${params.groupId}`)}
          className="px-5 py-3 bg-blue-500 text-white font-bold rounded-xl"
        >
          グループへ戻る
        </button>
      </main>
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
          key={`${payment.id}:${payment.version}`}
          members={snapshot.members}
          initialPayment={payment}
          disabled={syncStatus === "offline"}
          onSubmit={async (input) => {
            const result = await updatePayment(
              payment.id,
              payment.version,
              input
            );
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
