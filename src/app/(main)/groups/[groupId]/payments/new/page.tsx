"use client";

import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import AddPaymentForm from "@/components/features/add_payment/AddPaymentForm";
import {
  confirmDiscardChanges,
  useUnsavedChanges,
} from "@/components/features/add_payment/useUnsavedChanges";
import ActionButton from "@/components/ui/ActionButton";
import BackButton from "@/components/ui/BackButton";
import CachedDataNotice from "@/components/features/group/CachedDataNotice";
import CachedGroupFallbackButton from "@/components/features/group/CachedGroupFallbackButton";
import InlineNotice from "@/components/ui/InlineNotice";
import PageShell from "@/components/ui/PageShell";
import StatusPanel from "@/components/ui/StatusPanel";
import { useGroup } from "@/contexts/GroupContext";
import type { PaymentDraftInput } from "@/types";

export default function NewPaymentPage() {
  const params = useParams<{ groupId: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const pendingOperationId = searchParams.get("pending");
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
    addPayment,
    updatePendingPayment,
    syncPendingPayments,
    readPaymentDraft,
    savePaymentDraft,
    deletePaymentDraft,
  } = useGroup();
  const [isDirty, setIsDirty] = useState(false);
  const [initialDraft, setInitialDraft] = useState<PaymentDraftInput>();
  const [draftReady, setDraftReady] = useState(false);
  const [pendingError, setPendingError] = useState<string | null>(null);
  const [draftError, setDraftError] = useState<string | null>(null);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [fallbackBusy, setFallbackBusy] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const draftWriteQueueRef = useRef<Promise<void>>(Promise.resolve());
  const ignoreDraftWritesRef = useRef(false);
  const allowNextNavigation = useUnsavedChanges(isDirty);

  const discardNewDraft = useCallback(async () => {
    if (!offlineDataUserId) {
      setDraftError("端末データの保存先を確認できませんでした。");
      return false;
    }
    ignoreDraftWritesRef.current = true;
    await draftWriteQueueRef.current;
    const result = await deletePaymentDraft(
      offlineDataUserId,
      params.groupId,
      { kind: "new" }
    );
    if (!result.ok) {
      ignoreDraftWritesRef.current = false;
      setDraftError(result.message);
      return false;
    }
    setDraftError(null);
    return true;
  }, [deletePaymentDraft, offlineDataUserId, params.groupId]);

  useEffect(() => {
    ignoreDraftWritesRef.current = false;
    setDraftError(null);
  }, [params.groupId, pendingOperationId]);

  useEffect(() => {
    if (snapshotSource === "remote" && syncStatus === "connected") {
      setConnectionError(null);
    }
  }, [snapshotSource, syncStatus]);

  useEffect(() => {
    if (snapshot?.group.id !== params.groupId) {
      void loadGroup(params.groupId);
    }
  }, [loadGroup, params.groupId, snapshot?.group.id]);

  useEffect(() => {
    if (!snapshot || snapshot.group.id !== params.groupId) {
      setDraftReady(false);
      return;
    }

    let active = true;
    if (pendingOperationId) {
      const pending = pendingPayments.find(
        (payment) => payment.operationId === pendingOperationId
      );
      if (pending?.status === "queued") {
        setInitialDraft({
          title: pending.input.title,
          payerMemberId: pending.input.payerMemberId,
          amount: String(pending.input.amount),
          beneficiaryMemberIds: [...pending.input.beneficiaryMemberIds],
        });
        setPendingError(null);
        setDraftReady(true);
        return () => {
          active = false;
        };
      }

      const timeoutId = window.setTimeout(() => {
        if (!active) return;
        setPendingError(
          "この未同期支払いは修正できません。グループ画面で状態を確認してください。"
        );
        setDraftReady(true);
      }, 800);
      return () => {
        active = false;
        window.clearTimeout(timeoutId);
      };
    }

    if (!offlineDataUserId) {
      setDraftError("端末データの保存先を確認できませんでした。");
      setDraftReady(true);
      return;
    }
    void readPaymentDraft(
      offlineDataUserId,
      params.groupId,
      { kind: "new" }
    ).then((draft) => {
      if (!active) return;
      setInitialDraft(draft?.input);
      setPendingError(null);
      setDraftReady(true);
    });
    return () => {
      active = false;
    };
  }, [
    params.groupId,
    pendingOperationId,
    pendingPayments,
    offlineDataUserId,
    readPaymentDraft,
    snapshot,
  ]);

  const returnToGroup = async () => {
    if (!confirmDiscardChanges(isDirty)) return;
    if (!pendingOperationId) {
      const discarded = await discardNewDraft();
      if (!discarded) return;
    }
    allowNextNavigation();
    setIsDirty(false);
    router.replace(`/groups/${params.groupId}`);
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

  if (!snapshot || snapshot.group.id !== params.groupId) {
    const hasError = groupStatus === "error";
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
            hasError || cacheFallbackAvailable ? (
              <>
                {hasError && (
                  <ActionButton onClick={() => void loadGroup(params.groupId)}>
                    再試行
                  </ActionButton>
                )}
                {cacheFallbackAvailable && (
                  <CachedGroupFallbackButton
                    loading={fallbackBusy}
                    onClick={() => void handleLoadCachedGroup()}
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

  if (!draftReady) {
    return (
      <PageShell centered>
        <StatusPanel loading message="端末の入力内容を確認しています..." />
      </PageShell>
    );
  }

  if (pendingError) {
    return (
      <PageShell centered>
        <StatusPanel
          tone="warning"
          title="未同期支払いを修正できません"
          message={pendingError}
          actions={
            <ActionButton
              onClick={() => router.replace(`/groups/${params.groupId}`)}
            >
              グループへ戻る
            </ActionButton>
          }
        />
      </PageShell>
    );
  }

  return (
    <PageShell width="lg">
      <BackButton
        className="mb-3 self-start"
        onClick={() => void returnToGroup()}
      />
      {snapshotSource === "cache" && (
        <div className="mb-4 w-full">
          <CachedDataNotice
            cachedAt={cachedAt}
            pendingCount={pendingPayments.length}
            blockedCount={
              pendingPayments.filter((payment) => payment.status === "blocked")
                .length
            }
            authRecoveryRequired={authRecoveryRequired}
            retrying={retrying}
            onRetry={() => void handleRetryConnection()}
          />
        </div>
      )}
      {connectionError && (
        <InlineNotice tone="warning" className="mb-4">
          {connectionError}
        </InlineNotice>
      )}
      {draftError && (
        <InlineNotice tone="error" className="mb-4">
          {draftError}
        </InlineNotice>
      )}
      <AddPaymentForm
        key={pendingOperationId ?? "new-payment"}
        members={snapshot.members}
        defaultPayerMemberId={snapshot.group.currentMemberId}
        initialDraft={initialDraft}
        allowOfflineSubmit
        syncStatus={snapshotSource === "cache" ? "unavailable" : syncStatus}
        onDirtyChange={setIsDirty}
        onDraftChange={
          pendingOperationId
            ? undefined
            : (draft, dirty) => {
                const draftUserId = offlineDataUserId;
                draftWriteQueueRef.current = draftWriteQueueRef.current
                  .then(async () => {
                    if (ignoreDraftWritesRef.current) return;
                    if (!draftUserId) {
                      throw new Error("offline_data_user_missing");
                    }
                    const result = await savePaymentDraft(
                      draftUserId,
                      params.groupId,
                      { kind: "new" },
                      draft,
                      dirty
                    );
                    if (!ignoreDraftWritesRef.current) {
                      setDraftError(result.ok ? null : result.message);
                    }
                  })
                  .catch(() => {
                    if (!ignoreDraftWritesRef.current) {
                      setDraftError(
                        "入力内容を端末に保存できませんでした。空き容量とブラウザの設定を確認してください。"
                      );
                    }
                  });
              }
        }
        onSubmit={async (input) => {
          if (!pendingOperationId) {
            ignoreDraftWritesRef.current = true;
            await draftWriteQueueRef.current;
          }
          const result = pendingOperationId
            ? await updatePendingPayment(pendingOperationId, input)
            : await addPayment(input);
          if (result.ok) {
            if (pendingOperationId && syncStatus === "connected") {
              void syncPendingPayments();
            }
            allowNextNavigation();
            setIsDirty(false);
            router.replace(`/groups/${params.groupId}`);
          } else if (!pendingOperationId) {
            ignoreDraftWritesRef.current = false;
          }
          return result;
        }}
      />
    </PageShell>
  );
}
