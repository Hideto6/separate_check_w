"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import AddPaymentForm from "@/components/features/add_payment/AddPaymentForm";
import {
  confirmDiscardChanges,
  useUnsavedChanges,
} from "@/components/features/add_payment/useUnsavedChanges";
import ActionButton from "@/components/ui/ActionButton";
import BackButton from "@/components/ui/BackButton";
import InlineNotice from "@/components/ui/InlineNotice";
import PageShell from "@/components/ui/PageShell";
import StatusPanel from "@/components/ui/StatusPanel";
import { useGroup } from "@/contexts/GroupContext";
import type { PaymentRecord } from "@/types";

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
  const [isDirty, setIsDirty] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [formPayment, setFormPayment] = useState<PaymentRecord | null>(null);
  const [pendingPayment, setPendingPayment] =
    useState<PaymentRecord | null>(null);
  const [conflictMessage, setConflictMessage] = useState<string | null>(null);
  const payment =
    snapshot?.group.id === params.groupId
      ? snapshot.payments.find(
          (candidate) => candidate.id === params.paymentId
        )
      : undefined;
  const allowNextNavigation = useUnsavedChanges(isDirty);

  useEffect(() => {
    if (snapshot?.group.id !== params.groupId) {
      void loadGroup(params.groupId);
    }
  }, [loadGroup, params.groupId, snapshot?.group.id]);

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
  }, [conflictMessage, formPayment, isDirty, payment]);

  const returnToGroup = () => {
    if (!confirmDiscardChanges(isDirty)) return;
    allowNextNavigation();
    setIsDirty(false);
    router.replace(`/groups/${params.groupId}`);
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
            hasError ? (
              <>
                <ActionButton onClick={() => void loadGroup(params.groupId)}>
                  再試行
                </ActionButton>
                <ActionButton
                  variant="secondary"
                  onClick={() => router.replace("/")}
                >
                  ホームへ戻る
                </ActionButton>
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

  const editablePayment =
    formPayment?.id === payment.id ? formPayment : payment;

  return (
    <PageShell width="lg">
      <BackButton className="mb-3 self-start" onClick={returnToGroup} />
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
            onClick={() => {
              setFormPayment(pendingPayment);
              setPendingPayment(null);
              setIsDirty(false);
              setNotice(
                "ほかの参加者による変更を反映するため、入力中の内容を破棄して最新版へ切り替えました。"
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
        defaultPayerMemberId={snapshot.group.currentMemberId}
        syncStatus={syncStatus}
        onDirtyChange={setIsDirty}
        onSubmit={async (input) => {
          const result = await updatePayment(
            editablePayment.id,
            editablePayment.version,
            input
          );
          if (result.ok) {
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
