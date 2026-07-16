"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import BackButton from "@/components/ui/BackButton";
import GroupHeader from "@/components/features/group/GroupHeader";
import GroupSettings from "@/components/features/group/GroupSettings";
import RecordList from "@/components/features/group/RecordList";
import SettlementList from "@/components/features/group/SettlementList";
import TransferList from "@/components/features/group/TransferList";
import { useGroup } from "@/contexts/GroupContext";
import { calculateSettlement } from "@/lib/calculations";
import type { PaymentRecord, Settlement, SettlementTransfer } from "@/types";

export default function SharedGroupPage() {
  const params = useParams<{ groupId: string }>();
  const router = useRouter();
  const {
    snapshot,
    groupStatus,
    syncStatus,
    lastError,
    loadGroup,
    clearCurrentGroup,
    deletePayment,
    recordTransfer,
    deleteTransfer,
  } = useGroup();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (snapshot?.group.id !== params.groupId) {
      void loadGroup(params.groupId);
    }
  }, [loadGroup, params.groupId, snapshot?.group.id]);

  const settlements = useMemo(
    () =>
      snapshot
        ? calculateSettlement(
            snapshot.payments,
            snapshot.members,
            snapshot.transfers
          )
        : [],
    [snapshot]
  );

  const handleDeletePayment = async (payment: PaymentRecord) => {
    if (!window.confirm(`「${payment.title}」を削除しますか？`)) return;
    setBusy(true);
    const result = await deletePayment(payment.id, payment.version);
    setBusy(false);
    setMessage(result.ok ? "支払い記録を削除しました。" : result.message);
  };

  const handleSettlement = async (settlement: Settlement) => {
    if (!snapshot) return;
    const name = (id: string) =>
      snapshot.members.find((member) => member.id === id)?.name ?? "不明";
    if (
      !window.confirm(
        `${name(settlement.fromMemberId)}さんから${name(
          settlement.toMemberId
        )}さんへ${settlement.amount.toLocaleString("ja-JP")}円を精算済みにしますか？`
      )
    ) {
      return;
    }
    setBusy(true);
    const result = await recordTransfer(settlement);
    setBusy(false);
    setMessage(result.ok ? "精算を記録しました。" : result.message);
  };

  const handleDeleteTransfer = async (transfer: SettlementTransfer) => {
    if (!window.confirm("この精算記録を取り消しますか？")) return;
    setBusy(true);
    const result = await deleteTransfer(transfer.id, transfer.version);
    setBusy(false);
    setMessage(result.ok ? "精算記録を取り消しました。" : result.message);
  };

  if (
    groupStatus === "loading" ||
    !snapshot ||
    snapshot.group.id !== params.groupId
  ) {
    if (groupStatus === "error") {
      return (
        <main className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-blue-100 to-blue-400 p-6 text-center">
          <h1 className="text-2xl font-extrabold text-blue-800 mb-3">
            グループを開けません
          </h1>
          <p role="alert" className="font-bold text-red-600 mb-5">
            {lastError ?? "招待リンクから参加してください。"}
          </p>
          <button
            type="button"
            onClick={() => router.replace("/")}
            className="px-5 py-3 bg-blue-500 text-white font-bold rounded-xl"
          >
            ホームへ戻る
          </button>
        </main>
      );
    }
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-blue-100 to-blue-400 text-blue-800 font-bold">
        グループを読み込んでいます...
      </div>
    );
  }

  const editingDisabled = busy || syncStatus === "offline";
  return (
    <main className="min-h-screen flex flex-col items-center bg-gradient-to-b from-blue-100 to-blue-400 p-6">
      <BackButton
        className="self-start"
        onClick={() => {
          clearCurrentGroup();
          router.push("/");
        }}
      />
      <GroupHeader
        groupName={snapshot.group.name}
        members={snapshot.members}
        currentMemberId={snapshot.group.currentMemberId}
        syncStatus={syncStatus}
      />
      {message && (
        <p role="status" className="w-full max-w-md text-sm font-bold text-blue-800 bg-white/50 rounded-lg px-3 py-2 mb-3">
          {message}
        </p>
      )}
      {lastError && lastError !== message && (
        <p role="alert" className="w-full max-w-md text-sm font-bold text-red-700 bg-red-50 rounded-lg px-3 py-2 mb-3">
          {lastError}
        </p>
      )}
      <SettlementList
        settlements={settlements}
        members={snapshot.members}
        onComplete={(settlement) => void handleSettlement(settlement)}
        disabled={editingDisabled}
      />
      <TransferList
        transfers={snapshot.transfers}
        members={snapshot.members}
        onDelete={(transfer) => void handleDeleteTransfer(transfer)}
        disabled={editingDisabled}
      />
      <RecordList
        payments={snapshot.payments}
        members={snapshot.members}
        onDelete={(payment) => void handleDeletePayment(payment)}
        onEdit={(payment) =>
          router.push(`/groups/${snapshot.group.id}/payments/${payment.id}/edit`)
        }
        onAdd={() => router.push(`/groups/${snapshot.group.id}/payments/new`)}
        disabled={editingDisabled}
      />
      <GroupSettings
        snapshot={snapshot}
        onDeleted={() => router.replace("/")}
      />
    </main>
  );
}
