"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import BackButton from "@/components/ui/BackButton";
import GroupHeader from "@/components/features/group/GroupHeader";
import CachedDataNotice from "@/components/features/group/CachedDataNotice";
import CachedGroupFallbackButton from "@/components/features/group/CachedGroupFallbackButton";
import GroupQuickActions from "@/components/features/group/GroupQuickActions";
import GroupSettings from "@/components/features/group/GroupSettings";
import PendingPaymentList from "@/components/features/group/PendingPaymentList";
import PendingPaymentRecoveryPanel from "@/components/features/group/PendingPaymentRecoveryPanel";
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
  source: "context" | "action" | "connection";
}

export default function SharedGroupPage() {
  const params = useParams<{ groupId: string }>();
  const router = useRouter();
  const {
    snapshot,
    authRecoveryRequired,
    groupStatus,
    syncStatus,
    remoteStatus,
    snapshotSource,
    cachedAt,
    cacheFallbackAvailable,
    pendingPayments,
    lastError,
    groupErrorCode,
    loadGroup,
    loadCachedGroup,
    refreshGroup,
    syncPendingPayments,
    clearCurrentGroup,
    discardPendingPayment,
    deletePayment,
    recordTransfer,
    deleteTransfer,
    inspectOfflineGroupData,
    deleteOfflineGroupData,
  } = useGroup();
  const [busy, setBusy] = useState(false);
  const [fallbackBusy, setFallbackBusy] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [deletingRecoveryData, setDeletingRecoveryData] = useState(false);
  const [recoveryError, setRecoveryError] = useState<string | null>(null);
  const [notice, setNotice] = useState<GroupNotice | null>(null);
  const [actionSequence, setActionSequence] = useState(0);

  useEffect(() => {
    if (snapshot?.group.id !== params.groupId) {
      void loadGroup(params.groupId);
    }
  }, [loadGroup, params.groupId, snapshot?.group.id]);

  useEffect(() => {
    if (lastError) {
      setNotice({ message: lastError, tone: "error", source: "context" });
    } else if (syncStatus === "connected") {
      setNotice((current) =>
        current?.source === "context" || current?.source === "connection"
          ? null
          : current
      );
    }
  }, [lastError, syncStatus]);

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
  const showNotice = (
    message: string,
    tone: NoticeTone,
    source: GroupNotice["source"] = "action"
  ) => setNotice({ message, tone, source });

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

  const handleLoadCachedGroup = async () => {
    setFallbackBusy(true);
    try {
      await loadCachedGroup(params.groupId);
    } finally {
      setFallbackBusy(false);
    }
  };

  const handleRetryConnection = async () => {
    clearNotice();
    setRetrying(true);
    try {
      const refreshed = await refreshGroup();
      if (!refreshed.ok) {
        showNotice(refreshed.message, "error", "connection");
        return;
      }
      const synced = await syncPendingPayments();
      showNotice(
        synced.ok
          ? "共有データへ再接続しました。"
          : synced.message,
        synced.ok ? "success" : "warning",
        !synced.ok &&
          (synced.code === "offline" || synced.code === "unavailable")
          ? "connection"
          : "action"
      );
    } catch {
      showNotice(
        "再接続できませんでした。端末データのまま引き続き利用できます。",
        "warning",
        "connection"
      );
    } finally {
      setRetrying(false);
    }
  };

  const handleDiscardPendingPayment = async (
    operationId: string,
    title: string
  ) => {
    clearNotice();
    if (!window.confirm(`「${title}」の未同期データを破棄しますか？`)) {
      return;
    }
    const result = await discardPendingPayment(operationId);
    showNotice(
      result.ok ? "未同期の支払いを破棄しました。" : result.message,
      result.ok ? "success" : "error"
    );
  };

  const handleDeleteRecoveryData = async () => {
    setRecoveryError(null);
    const inspected = await inspectOfflineGroupData(params.groupId);
    if (!inspected.ok) {
      setRecoveryError(inspected.message);
      return;
    }
    const { cachedSnapshotCount, draftCount, pendingCount } = inspected.data;
    if (
      !window.confirm(
        `この端末のキャッシュ${cachedSnapshotCount}件、入力下書き${draftCount}件、未同期の支払い${pendingCount}件を削除しますか？正式データには影響しません。`
      )
    ) {
      return;
    }
    setDeletingRecoveryData(true);
    try {
      const result = await deleteOfflineGroupData(params.groupId);
      if (result.ok) {
        router.replace("/");
      } else {
        setRecoveryError(result.message);
      }
    } catch {
      setRecoveryError(
        "端末データを削除できませんでした。ブラウザの設定を確認してください。"
      );
    } finally {
      setDeletingRecoveryData(false);
    }
  };

  if (
    groupStatus === "loading" ||
    !snapshot ||
    snapshot.group.id !== params.groupId
  ) {
    if (groupStatus === "error") {
      return (
        <PageShell centered contentClassName="gap-4">
          <StatusPanel
            title="グループを開けません"
            message={lastError ?? "招待リンクから参加してください。"}
            tone="error"
            actions={
              <>
                <ActionButton onClick={() => void loadGroup(params.groupId)}>
                  もう一度試す
                </ActionButton>
                {cacheFallbackAvailable && (
                  <CachedGroupFallbackButton
                    loading={fallbackBusy}
                    onClick={() => void handleLoadCachedGroup()}
                  />
                )}
                <ActionButton variant="secondary" onClick={handleHome}>
                  ホームへ戻る
                </ActionButton>
              </>
            }
          />
          {recoveryError && (
            <InlineNotice tone="error">{recoveryError}</InlineNotice>
          )}
          {groupErrorCode === "forbidden" && (
            <PendingPaymentRecoveryPanel
              pendingPayments={pendingPayments}
              deleting={deletingRecoveryData}
              onDeleteAll={() => void handleDeleteRecoveryData()}
            />
          )}
        </PageShell>
      );
    }
    return (
      <PageShell centered>
        <StatusPanel
          title="グループを読み込み中"
          message="共有データを確認しています。"
          loading
          actions={
            cacheFallbackAvailable ? (
              <CachedGroupFallbackButton
                loading={fallbackBusy}
                onClick={() => void handleLoadCachedGroup()}
              />
            ) : undefined
          }
        />
      </PageShell>
    );
  }

  const isUsingCachedData =
    snapshotSource === "cache" ||
    syncStatus === "offline" ||
    syncStatus === "unavailable";
  const editingDisabled = busy || isUsingCachedData;
  const offlineReason = isUsingCachedData
    ? "端末データの表示中は既存の支払い・精算・グループ設定を変更できません。新しい支払いは端末へ保存できます。"
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

      {isUsingCachedData && (
        <div id="group-offline-reason" className="w-full">
          <CachedDataNotice
            cachedAt={cachedAt}
            pendingCount={pendingPayments.length}
            blockedCount={
              pendingPayments.filter((payment) => payment.status === "blocked")
                .length
            }
            authRecoveryRequired={authRecoveryRequired}
            retrying={
              retrying ||
              remoteStatus === "connecting" ||
              remoteStatus === "reconnecting"
            }
            onRetry={() => void handleRetryConnection()}
          />
        </div>
      )}

      {!isUsingCachedData &&
        (remoteStatus === "connecting" || remoteStatus === "reconnecting") && (
          <InlineNotice tone="warning">
            共有データへ再接続しています。閲覧と入力は続けられます。
          </InlineNotice>
        )}

      {notice && (
        <InlineNotice tone={notice.tone}>{notice.message}</InlineNotice>
      )}

      <GroupQuickActions
        isOwner={snapshot.group.role === "owner"}
        inviteEnabled={snapshot.group.inviteEnabled}
        actionSequence={actionSequence}
        disabled={editingDisabled}
        addPaymentDisabled={busy}
        disabledReason={offlineReason}
        onAddPayment={() =>
          router.push(`/groups/${snapshot.group.id}/payments/new`)
        }
        onActionStart={clearNotice}
        onNotice={showNotice}
      />

      <PendingPaymentList
        pendingPayments={pendingPayments}
        members={snapshot.members}
        onEdit={(payment) => {
          clearNotice();
          router.push(
            `/groups/${snapshot.group.id}/payments/new?pending=${encodeURIComponent(payment.operationId)}`
          );
        }}
        onDiscard={(payment) =>
          void handleDiscardPendingPayment(
            payment.operationId,
            payment.input.title
          )
        }
      />

      {authRecoveryRequired && pendingPayments.length > 0 && (
        <PendingPaymentRecoveryPanel
          reason="authentication"
          pendingPayments={pendingPayments}
          deleting={deletingRecoveryData}
          onDeleteAll={() => void handleDeleteRecoveryData()}
        />
      )}

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
        remoteDisabled={isUsingCachedData}
        disabledReason={offlineReason}
        pendingCount={pendingPayments.length}
        onActionStart={clearNotice}
        onNotice={showNotice}
        onDeleted={() => router.replace("/")}
        onInspectOfflineData={inspectOfflineGroupData}
        onDeleteOfflineData={deleteOfflineGroupData}
        onOfflineDataDeleted={() => {
          if (snapshotSource === "cache") {
            router.replace("/");
          }
        }}
      />
    </PageShell>
  );
}
