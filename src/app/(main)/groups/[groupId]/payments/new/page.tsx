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
import PageShell from "@/components/ui/PageShell";
import StatusPanel from "@/components/ui/StatusPanel";
import { useGroup } from "@/contexts/GroupContext";

export default function NewPaymentPage() {
  const params = useParams<{ groupId: string }>();
  const router = useRouter();
  const {
    snapshot,
    groupStatus,
    syncStatus,
    lastError,
    loadGroup,
    addPayment,
  } = useGroup();
  const [isDirty, setIsDirty] = useState(false);
  const allowNextNavigation = useUnsavedChanges(isDirty);

  useEffect(() => {
    if (snapshot?.group.id !== params.groupId) {
      void loadGroup(params.groupId);
    }
  }, [loadGroup, params.groupId, snapshot?.group.id]);

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

  return (
    <PageShell width="lg">
      <BackButton className="mb-3 self-start" onClick={returnToGroup} />
      <AddPaymentForm
        members={snapshot.members}
        defaultPayerMemberId={snapshot.group.currentMemberId}
        syncStatus={syncStatus}
        onDirtyChange={setIsDirty}
        onSubmit={async (input) => {
          const result = await addPayment(input);
          if (result.ok) {
            allowNextNavigation();
            setIsDirty(false);
            router.replace(`/groups/${params.groupId}`);
          }
          return result;
        }}
      />
    </PageShell>
  );
}
