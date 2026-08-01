"use client";

import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import AddPaymentForm from "@/components/features/add_payment/AddPaymentForm";
import {
  confirmDiscardChanges,
  useUnsavedChanges,
} from "@/components/features/add_payment/useUnsavedChanges";
import CachedDataNotice from "@/components/features/group/CachedDataNotice";
import CachedGroupFallbackButton from "@/components/features/group/CachedGroupFallbackButton";
import ActionButton from "@/components/ui/ActionButton";
import BackButton from "@/components/ui/BackButton";
import InlineNotice from "@/components/ui/InlineNotice";
import PageShell from "@/components/ui/PageShell";
import StatusPanel from "@/components/ui/StatusPanel";
import { useGroup } from "@/contexts/GroupContext";
import type {
  PaymentDraftInput,
  PaymentDraftTarget,
  PaymentRecord,
} from "@/types";

interface LoadedDraft {
  key: string;
  input?: PaymentDraftInput;
}

const draftKeyFor = (target: PaymentDraftTarget) =>
  target.kind === "new"
    ? "new"
    : `${target.paymentId}:${target.baseVersion}`;

export default function EditPaymentPage() {
  const params = useParams<{ groupId: string; paymentId: string }>();
  const router = useRouter();
  const {
    snapshot,
    offlineDataUserId,
    authRecoveryRequired,
    groupStatus,
    syncStatus,
    snapshotSource,
    cachedAt,
    cacheFallbackAvailable,
    pendingPayments,
    lastError,
    loadGroup,
    loadCachedGroup,
    refreshGroup,
    readPaymentDraft,
    savePaymentDraft,
    deletePaymentDraft,
    updatePayment,
  } = useGroup();
  const [isDirty, setIsDirty] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [draftError, setDraftError] = useState<string | null>(null);
  const [loadedDraft, setLoadedDraft] = useState<LoadedDraft | null>(null);
  const [fallbackLoading, setFallbackLoading] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [discardingDraft, setDiscardingDraft] = useState(false);
  const [formPayment, setFormPayment] = useState<PaymentRecord | null>(null);
  const [pendingPayment, setPendingPayment] =
    useState<PaymentRecord | null>(null);
  const [conflictMessage, setConflictMessage] = useState<string | null>(null);
  const draftWriteQueueRef = useRef<Promise<void>>(Promise.resolve());
  const ignoredDraftKeyRef = useRef<string | null>(null);
  const payment =
    snapshot?.group.id === params.groupId
      ? snapshot.payments.find(
          (candidate) => candidate.id === params.paymentId
        )
      : undefined;
  const editablePayment =
    payment && formPayment?.id === payment.id ? formPayment : payment;
  const draftTarget = useMemo<PaymentDraftTarget | null>(
    () =>
      editablePayment
        ? {
            kind: "edit",
            paymentId: editablePayment.id,
            baseVersion: editablePayment.version,
          }
        : null,
    [editablePayment]
  );
  const draftKey = draftTarget ? draftKeyFor(draftTarget) : null;
  const allowNextNavigation = useUnsavedChanges(isDirty);

  const discardStoredDraft = useCallback(
    async (target: PaymentDraftTarget, key: string) => {
      if (!offlineDataUserId) {
        setDraftError("端末データの保存先を確認できませんでした。");
        return false;
      }
      ignoredDraftKeyRef.current = key;
      await draftWriteQueueRef.current;
      try {
        const result = await deletePaymentDraft(
          offlineDataUserId,
          params.groupId,
          target
        );
        if (result.ok) {
          setDraftError(null);
          return true;
        }
        ignoredDraftKeyRef.current = null;
        setDraftError(result.message);
        return false;
      } catch {
        ignoredDraftKeyRef.current = null;
        setDraftError(
          "端末の下書きを削除できませんでした。空き容量とブラウザの設定を確認してください。"
        );
        return false;
      }
    },
    [deletePaymentDraft, offlineDataUserId, params.groupId]
  );

  useEffect(() => {
    if (snapshot?.group.id !== params.groupId) {
      void loadGroup(params.groupId);
    }
  }, [loadGroup, params.groupId, snapshot?.group.id]);

  useEffect(() => {
    if (!draftTarget || !draftKey) {
      setLoadedDraft(null);
      return;
    }

    let active = true;
    setLoadedDraft((current) =>
      current?.key === draftKey ? current : null
    );
    if (!offlineDataUserId) {
      setDraftError("端末データの保存先を確認できませんでした。");
      setLoadedDraft({ key: draftKey });
      return;
    }
    void readPaymentDraft(offlineDataUserId, params.groupId, draftTarget)
      .then((draft) => {
        if (!active) return;
        setLoadedDraft({ key: draftKey, input: draft?.input });
      })
      .catch(() => {
        if (!active) return;
        setDraftError(
          "端末の下書きを読み込めませんでした。新しく入力して続けられます。"
        );
        setLoadedDraft({ key: draftKey });
      });

    return () => {
      active = false;
    };
  }, [
    draftKey,
    draftTarget,
    offlineDataUserId,
    params.groupId,
    readPaymentDraft,
  ]);

  useEffect(() => {
    if (!payment) return;
    if (!formPayment || formPayment.id !== payment.id) {
      setFormPayment(payment);
      setPendingPayment(null);
      setConflictMessage(null);
      setNotice(null);
      return;
    }
    if (formPayment.version === payment.version) return;

    if (conflictMessage) {
      const previousTarget: PaymentDraftTarget = {
        kind: "edit",
        paymentId: formPayment.id,
        baseVersion: formPayment.version,
      };
      void discardStoredDraft(previousTarget, draftKeyFor(previousTarget));
      setFormPayment(payment);
      setPendingPayment(null);
      setIsDirty(false);
      setNotice(
        `${conflictMessage} 競合した入力を破棄し、最新の支払い内容へ切り替えました。`
      );
      setConflictMessage(null);
      return;
    }

    if (isDirty) {
      setPendingPayment(payment);
      setNotice(null);
      return;
    }

    setFormPayment(payment);
    setPendingPayment(null);
    setNotice(
      "ほかの参加者による変更を反映し、最新の支払い内容へ切り替えました。"
    );
  }, [
    conflictMessage,
    discardStoredDraft,
    formPayment,
    isDirty,
    payment,
  ]);

  const returnToGroup = async () => {
    const hasStoredDraft = Boolean(loadedDraft?.input);
    if (!confirmDiscardChanges(isDirty || hasStoredDraft)) return;

    if (draftTarget && draftKey && (isDirty || hasStoredDraft)) {
      setDiscardingDraft(true);
      const discarded = await discardStoredDraft(draftTarget, draftKey);
      setDiscardingDraft(false);
      if (!discarded) return;
    }

    allowNextNavigation();
    setIsDirty(false);
    router.replace(`/groups/${params.groupId}`);
  };

  const handleUseCachedGroup = async () => {
    setFallbackLoading(true);
    try {
      await loadCachedGroup(params.groupId);
    } finally {
      setFallbackLoading(false);
    }
  };

  const retryConnection = async () => {
    setRetrying(true);
    setConnectionError(null);
    try {
      const result = await refreshGroup();
      if (!result.ok) setConnectionError(result.message);
    } catch {
      setConnectionError(
        "再接続できませんでした。端末データのまま引き続き利用できます。"
      );
    } finally {
      setRetrying(false);
    }
  };

  useEffect(() => {
    if (snapshotSource === "remote" && syncStatus === "connected") {
      setConnectionError(null);
    }
  }, [snapshotSource, syncStatus]);

  if (!snapshot || snapshot.group.id !== params.groupId) {
    const hasError = groupStatus === "error";
    const hasActions = hasError || cacheFallbackAvailable;
    return (
      <PageShell centered>
        <StatusPanel
          loading={!hasError}
          tone={hasError ? "error" : "info"}
          title={hasError ? "グループを開けません" : undefined}
          message={
            hasError
              ? lastError ?? "グループを開けませんでした。"
              : "グループを読み込んでいます..."
          }
          actions={
            hasActions ? (
              <>
                {hasError && (
                  <ActionButton onClick={() => void loadGroup(params.groupId)}>
                    再試行
                  </ActionButton>
                )}
                {cacheFallbackAvailable && (
                  <CachedGroupFallbackButton
                    loading={fallbackLoading}
                    onClick={() => void handleUseCachedGroup()}
                  />
                )}
                {hasError && (
                  <ActionButton
                    variant="secondary"
                    onClick={() => router.replace("/")}
                  >
                    ホームへ戻る
                  </ActionButton>
                )}
              </>
            ) : undefined
          }
        />
      </PageShell>
    );
  }

  if (!payment) {
    return (
      <PageShell centered>
        <StatusPanel
          tone="error"
          title="支払い記録が見つかりません"
          message="ほかの参加者が削除した可能性があります。グループ画面で最新の状態を確認してください。"
          actions={
            <>
              <ActionButton
                onClick={() => router.replace(`/groups/${params.groupId}`)}
              >
                グループへ戻る
              </ActionButton>
              <ActionButton
                variant="secondary"
                onClick={() => router.replace("/")}
              >
                ホームへ戻る
              </ActionButton>
            </>
          }
        />
      </PageShell>
    );
  }

  if (!editablePayment || !draftTarget || !draftKey) {
    return null;
  }

  if (loadedDraft?.key !== draftKey) {
    return (
      <PageShell centered width="lg">
        <StatusPanel
          loading
          title="下書きを確認しています"
          message="この端末に保存された入力内容を確認しています..."
        />
      </PageShell>
    );
  }

  const formSyncStatus =
    snapshotSource === "cache" ? "unavailable" : syncStatus;

  return (
    <PageShell width="lg">
      <BackButton
        className={`mb-3 self-start ${discardingDraft ? "opacity-60" : ""}`}
        onClick={() => {
          if (!discardingDraft) void returnToGroup();
        }}
      />
      {snapshotSource === "cache" && (
        <div className="mb-4 w-full">
          <CachedDataNotice
            cachedAt={cachedAt}
            pendingCount={pendingPayments.length}
            blockedCount={
              pendingPayments.filter((pending) => pending.status === "blocked")
                .length
            }
            authRecoveryRequired={authRecoveryRequired}
            retrying={retrying}
            onRetry={() => void retryConnection()}
          />
        </div>
      )}
      {loadedDraft.input && (
        <InlineNotice tone="info" className="mb-4">
          この端末に保存されていた入力内容を復元しました。
        </InlineNotice>
      )}
      {draftError && (
        <InlineNotice tone="error" className="mb-4">
          {draftError}
        </InlineNotice>
      )}
      {connectionError && (
        <InlineNotice tone="warning" className="mb-4">
          {connectionError}
        </InlineNotice>
      )}
      {notice && (
        <InlineNotice tone="warning" className="mb-4">
          {notice}
        </InlineNotice>
      )}
      {pendingPayment && (
        <div className="mb-4 space-y-2">
          <InlineNotice tone="warning">
            ほかの参加者がこの支払いを変更しました。入力中の内容は保持しています。最新版へ切り替えると、現在の入力は破棄されます。
          </InlineNotice>
          <ActionButton
            type="button"
            variant="secondary"
            loading={discardingDraft}
            loadingLabel="下書きを破棄しています..."
            onClick={() => {
              const latestPayment = pendingPayment;
              setDiscardingDraft(true);
              void discardStoredDraft(draftTarget, draftKey).then(
                (discarded) => {
                  setDiscardingDraft(false);
                  if (!discarded) return;
                  setFormPayment(latestPayment);
                  setPendingPayment(null);
                  setIsDirty(false);
                  setNotice(
                    "ほかの参加者による変更を反映するため、入力中の内容を破棄して最新版へ切り替えました。"
                  );
                }
              );
            }}
          >
            最新版を読み込む
          </ActionButton>
        </div>
      )}
      <AddPaymentForm
        key={`${editablePayment.id}:${editablePayment.version}`}
        members={snapshot.members}
        initialPayment={editablePayment}
        initialDraft={loadedDraft.input}
        defaultPayerMemberId={snapshot.group.currentMemberId}
        syncStatus={formSyncStatus}
        onDirtyChange={setIsDirty}
        onDraftChange={(input, dirty) => {
          const target = draftTarget;
          const targetKey = draftKey;
          const draftUserId = offlineDataUserId;
          draftWriteQueueRef.current = draftWriteQueueRef.current
            .then(async () => {
              if (ignoredDraftKeyRef.current === targetKey) return;
              if (!draftUserId) {
                throw new Error("offline_data_user_missing");
              }
              const result = await savePaymentDraft(
                draftUserId,
                params.groupId,
                target,
                input,
                dirty
              );
              if (ignoredDraftKeyRef.current === targetKey) return;
              setDraftError(result.ok ? null : result.message);
              if (result.ok && !dirty) {
                setLoadedDraft((current) =>
                  current?.key === targetKey ? { key: targetKey } : current
                );
              }
            })
            .catch(() => {
              if (ignoredDraftKeyRef.current !== targetKey) {
                setDraftError(
                  "下書きを端末に保存できませんでした。空き容量とブラウザの設定を確認してください。"
                );
              }
            });
        }}
        onSubmit={async (input) => {
          const result = await updatePayment(
            editablePayment.id,
            editablePayment.version,
            input
          );
          if (result.ok) {
            await discardStoredDraft(draftTarget, draftKey);
            allowNextNavigation();
            setIsDirty(false);
            router.replace(`/groups/${params.groupId}`);
          } else if (result.code === "conflict") {
            setConflictMessage(result.message);
            setNotice(result.message);
          }
          return result;
        }}
      />
    </PageShell>
  );
}
