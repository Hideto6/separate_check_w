"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import BackButton from "@/components/ui/BackButton";
import GroupHeader from "@/components/features/group/GroupHeader";
import GroupQuickActions from "@/components/features/group/GroupQuickActions";
import GroupSettings from "@/components/features/group/GroupSettings";
import RecordList from "@/components/features/group/RecordList";
import SettlementList from "@/components/features/group/SettlementList";
import TransferList from "@/components/features/group/TransferList";
import ActionButton from "@/components/ui/ActionButton";
import InlineNotice from "@/components/ui/InlineNotice";
import PageShell from "@/components/ui/PageShell";
import StatusPanel from "@/components/ui/StatusPanel";
import { useGroup } from "@/contexts/GroupContext";
import { calculateSettlement } from "@/lib/calculations";
import type { PaymentRecord, Settlement, SettlementTransfer } from "@/types";

type NoticeTone = "info" | "success" | "warning" | "error";

interface GroupNotice {
  message: string;
  tone: NoticeTone;
}

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
  const [notice, setNotice] = useState<GroupNotice | null>(null);
  const [actionSequence, setActionSequence] = useState(0);

  useEffect(() => {
    if (snapshot?.group.id !== params.groupId) {
      void loadGroup(params.groupId);
    }
  }, [loadGroup, params.groupId, snapshot?.group.id]);

  useEffect(() => {
    if (lastError) {
      setNotice({ message: lastError, tone: "error" });
    }
  }, [lastError]);

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

  const clearNotice = () => {
    setNotice(null);
    setActionSequence((current) => current + 1);
  };
  const showNotice = (message: string, tone: NoticeTone) =>
    setNotice({ message, tone });

  const handleDeletePayment = async (payment: PaymentRecord) => {
    clearNotice();
    if (!window.confirm(`「${payment.title}」を削除しますか？`)) return;
    setBusy(true);
    try {
      const result = await deletePayment(payment.id, payment.version);
      showNotice(
        result.ok ? "支払い記録を削除しました。" : result.message,
        result.ok ? "success" : "error"
      );
    } catch {
      showNotice(
        "支払い記録を削除できませんでした。通信状態を確認して、もう一度お試しください。",
        "error"
      );
    } finally {
      setBusy(false);
    }
  };

  const handleSettlement = async (settlement: Settlement) => {
    if (!snapshot) return;
    clearNotice();
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
    try {
      const result = await recordTransfer(settlement);
      showNotice(
        result.ok ? "精算を記録しました。" : result.message,
        result.ok ? "success" : "error"
      );
    } catch {
      showNotice(
        "精算を記録できませんでした。通信状態を確認して、もう一度お試しください。",
        "error"
      );
    } finally {
      setBusy(false);
    }
  };

  const handleDeleteTransfer = async (transfer: SettlementTransfer) => {
    clearNotice();
    if (!window.confirm("この精算記録を取り消しますか？")) return;
    setBusy(true);
    try {
      const result = await deleteTransfer(transfer.id, transfer.version);
      showNotice(
        result.ok ? "精算記録を取り消しました。" : result.message,
        result.ok ? "success" : "error"
      );
    } catch {
      showNotice(
        "精算記録を取り消せませんでした。通信状態を確認して、もう一度お試しください。",
        "error"
      );
    } finally {
      setBusy(false);
    }
  };

  const handleHome = () => {
    clearCurrentGroup();
    router.push("/");
  };

  if (
    groupStatus === "loading" ||
    !snapshot ||
    snapshot.group.id !== params.groupId
  ) {
    if (groupStatus === "error") {
      return (
        <PageShell centered>
          <StatusPanel
            title="グループを開けません"
            message={lastError ?? "招待リンクから参加してください。"}
            tone="error"
            actions={
              <>
                <ActionButton onClick={() => void loadGroup(params.groupId)}>
                  もう一度試す
                </ActionButton>
                <ActionButton variant="secondary" onClick={handleHome}>
                  ホームへ戻る
                </ActionButton>
              </>
            }
          />
        </PageShell>
      );
    }
    return (
      <PageShell centered>
        <StatusPanel
          title="グループを読み込み中"
          message="共有データを確認しています。"
          loading
        />
      </PageShell>
    );
  }

  const isOffline = syncStatus === "offline";
  const editingDisabled = busy || isOffline;
  const offlineReason = isOffline
    ? "オフライン中は支払い・精算・グループ設定を変更できません。接続が戻るまで閲覧のみ利用できます。"
    : undefined;

  return (
    <PageShell contentClassName="gap-4">
      <BackButton
        className="self-start"
        onClick={handleHome}
      />
      <GroupHeader
        groupName={snapshot.group.name}
        members={snapshot.members}
        currentMemberId={snapshot.group.currentMemberId}
      />

      {isOffline && (
        <div id="group-offline-reason" className="w-full">
          <InlineNotice tone="warning">{offlineReason}</InlineNotice>
        </div>
      )}

      {notice && (
        <InlineNotice tone={notice.tone}>{notice.message}</InlineNotice>
      )}

      <GroupQuickActions
        isOwner={snapshot.group.role === "owner"}
        inviteEnabled={snapshot.group.inviteEnabled}
        actionSequence={actionSequence}
        disabled={editingDisabled}
        disabledReason={offlineReason}
        onAddPayment={() =>
          router.push(`/groups/${snapshot.group.id}/payments/new`)
        }
        onActionStart={clearNotice}
        onNotice={showNotice}
      />

      <SettlementList
        settlements={settlements}
        members={snapshot.members}
        paymentCount={snapshot.payments.length}
        onComplete={(settlement) => void handleSettlement(settlement)}
        disabled={editingDisabled}
        disabledReason={offlineReason}
      />
      <TransferList
        transfers={snapshot.transfers}
        members={snapshot.members}
        onDelete={(transfer) => void handleDeleteTransfer(transfer)}
        disabled={editingDisabled}
        disabledReason={offlineReason}
      />
      <RecordList
        payments={snapshot.payments}
        members={snapshot.members}
        onDelete={(payment) => void handleDeletePayment(payment)}
        onEdit={(payment) => {
          clearNotice();
          router.push(`/groups/${snapshot.group.id}/payments/${payment.id}/edit`);
        }}
        disabled={editingDisabled}
        disabledReason={offlineReason}
      />
      <GroupSettings
        snapshot={snapshot}
        disabled={busy}
        disabledReason={offlineReason}
        onActionStart={clearNotice}
        onNotice={showNotice}
        onDeleted={() => router.replace("/")}
      />
    </PageShell>
  );
}
