"use client";

import { useState } from "react";
import ActionButton from "@/components/ui/ActionButton";
import ContentBox from "@/components/ui/ContentBox";
import InlineNotice from "@/components/ui/InlineNotice";
import { formatCurrency } from "@/lib/formatters";
import { pendingPaymentsAsText } from "@/lib/offlineRecovery";
import type { PendingPayment } from "@/types";

export default function PendingPaymentRecoveryPanel({
  pendingPayments,
  deleting,
  onDeleteAll,
  reason = "access_lost",
}: {
  pendingPayments: PendingPayment[];
  deleting?: boolean;
  onDeleteAll?: () => void;
  reason?: "access_lost" | "authentication";
}) {
  const [copyMessage, setCopyMessage] = useState<string | null>(null);

  const handleCopy = async () => {
    const text = pendingPaymentsAsText(pendingPayments);
    try {
      await navigator.clipboard.writeText(text);
      setCopyMessage("未同期の支払い内容をコピーしました。");
    } catch {
      window.prompt("下の内容を長押ししてコピーしてください。", text);
      setCopyMessage("コピー画面を表示しました。");
    }
  };

  return (
    <ContentBox
      title={
        pendingPayments.length > 0
          ? "端末に残っている未同期データ"
          : "この端末の保存データ"
      }
      containerClassName="w-full border-2 border-red-200 bg-red-50"
      titleClassName="text-red-800"
      bodyClassName="space-y-4 border-2 border-red-200 bg-white/90"
    >
      <InlineNotice tone="warning">
        {reason === "authentication"
          ? "同じ匿名認証セッションを確認できないため、自動登録を待機しています。まず内容をコピーし、セッションを復旧できない場合だけ端末データを削除してください。"
          : pendingPayments.length > 0
          ? "自動登録は停止しています。内容をコピーして控えたうえで、不要になった場合だけ端末データを削除してください。"
          : "削除または権限喪失が確認されたグループの端末データです。不要になった場合は削除してください。"}
      </InlineNotice>

      {pendingPayments.length > 0 && (
        <div className="space-y-2">
          {pendingPayments.map((payment) => (
            <article
              key={payment.operationId}
              className="rounded-xl border border-red-100 bg-red-50/60 p-3"
            >
              <div className="flex min-w-0 flex-wrap justify-between gap-2">
                <h3 className="min-w-0 flex-1 font-extrabold text-gray-800 [overflow-wrap:anywhere]">
                  {payment.input.title}
                </h3>
                <p className="font-extrabold tabular-nums text-gray-800">
                  {formatCurrency(payment.input.amount)}円
                </p>
              </div>
              <p className="mt-1 text-xs font-bold text-red-700">
                {payment.status === "blocked" ? "確認が必要" : "未同期"}
              </p>
              <p className="mt-1 text-xs font-medium text-gray-600 [overflow-wrap:anywhere]">
                グループID: {payment.groupId}
              </p>
              <p className="mt-1 text-xs font-medium text-gray-600 [overflow-wrap:anywhere]">
                支払者ID: {payment.input.payerMemberId}
              </p>
              <p className="mt-1 text-xs font-medium text-gray-600 [overflow-wrap:anywhere]">
                精算対象ID: {payment.input.beneficiaryMemberIds.join(", ")}
              </p>
            </article>
          ))}
        </div>
      )}

      {copyMessage && (
        <p role="status" className="text-sm font-bold text-emerald-700">
          {copyMessage}
        </p>
      )}

      <div
        className={
          pendingPayments.length > 0 && onDeleteAll
            ? "grid gap-2 sm:grid-cols-2"
            : "grid"
        }
      >
        {pendingPayments.length > 0 && (
          <ActionButton type="button" variant="secondary" onClick={handleCopy}>
            内容をコピー
          </ActionButton>
        )}
        {onDeleteAll && (
          <ActionButton
            type="button"
            variant="danger"
            loading={deleting}
            loadingLabel="削除しています..."
            onClick={onDeleteAll}
          >
            端末データを削除
          </ActionButton>
        )}
      </div>
    </ContentBox>
  );
}
