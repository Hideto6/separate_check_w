"use client";

import { FaUser, FaUsers } from "react-icons/fa";
import { IoCloseSharp, IoPencil } from "react-icons/io5";
import ContentBox from "@/components/ui/ContentBox";
import { formatCurrency } from "@/lib/formatters";
import type { Member, PendingPayment } from "@/types";

const STATUS_PRESENTATION: Record<
  PendingPayment["status"],
  { badge: string; message: string; className: string }
> = {
  queued: {
    badge: "端末に保存済み",
    message: "接続後に自動で登録します。",
    className: "border-amber-300 bg-amber-100 text-amber-900",
  },
  sending: {
    badge: "送信中",
    message: "支払いを登録しています。完了するまで変更できません。",
    className: "border-blue-300 bg-blue-100 text-blue-800",
  },
  retry: {
    badge: "再試行待ち",
    message: "接続が戻り次第、自動で再試行します。",
    className: "border-orange-300 bg-orange-100 text-orange-900",
  },
  committed: {
    badge: "反映確認中",
    message: "登録結果を確認しています。完了するまで変更できません。",
    className: "border-emerald-300 bg-emerald-100 text-emerald-800",
  },
  blocked: {
    badge: "確認が必要",
    message: "自動登録を停止しました。内容を確認してください。",
    className: "border-red-300 bg-red-100 text-red-800",
  },
};

export default function PendingPaymentList({
  pendingPayments,
  members,
  onEdit,
  onDiscard,
}: {
  pendingPayments: PendingPayment[];
  members: Member[];
  onEdit: (payment: PendingPayment) => void;
  onDiscard: (payment: PendingPayment) => void;
}) {
  if (pendingPayments.length === 0) return null;

  const memberName = (memberId: string) =>
    members.find((member) => member.id === memberId)?.name ?? "不明なメンバー";

  return (
    <ContentBox
      title="未同期の支払い"
      containerClassName="w-full border-2 border-amber-200 bg-amber-50"
      titleClassName="text-amber-900"
      bodyClassName="overflow-hidden border-2 border-amber-200 bg-white/80"
    >
      <div aria-live="polite">
        {pendingPayments.map((payment) => {
          const presentation = STATUS_PRESENTATION[payment.status];
          const canChange = payment.status === "queued";
          const statusMessage =
            (payment.status === "retry" || payment.status === "blocked") &&
            payment.lastError
              ? payment.lastError
              : presentation.message;

          return (
            <article
              key={payment.operationId}
              className="border-b border-amber-200 px-3 py-4 last:border-b-0 sm:px-4"
            >
              <div className="mb-3 flex min-w-0 flex-wrap items-start justify-between gap-2">
                <h3 className="min-w-0 flex-1 text-base font-extrabold text-gray-800 [overflow-wrap:anywhere]">
                  {payment.input.title}
                </h3>
                <p className="shrink-0 text-right text-lg font-extrabold tabular-nums text-gray-800 [overflow-wrap:anywhere]">
                  {formatCurrency(payment.input.amount)}円
                </p>
              </div>

              <div className="space-y-2 text-sm font-semibold text-gray-600">
                <p className="flex min-w-0 items-start">
                  <FaUser
                    aria-hidden="true"
                    size={15}
                    className="mr-2 mt-0.5 shrink-0 text-blue-500"
                  />
                  <span className="[overflow-wrap:anywhere]">
                    支払う人：{memberName(payment.input.payerMemberId)}
                  </span>
                </p>
                <p className="flex min-w-0 items-start">
                  <FaUsers
                    aria-hidden="true"
                    size={17}
                    className="mr-2 mt-0.5 shrink-0 text-red-500"
                  />
                  <span className="[overflow-wrap:anywhere]">
                    精算するメンバー：
                    {payment.input.beneficiaryMemberIds.map(memberName).join("、")}
                  </span>
                </p>
              </div>

              <div className="mt-3 rounded-xl border border-gray-200 bg-white px-3 py-2.5">
                <span
                  className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-extrabold ${presentation.className}`}
                >
                  {presentation.badge}
                </span>
                <p className="mt-2 text-sm font-semibold text-gray-700 [overflow-wrap:anywhere]">
                  {statusMessage}
                </p>
              </div>

              {canChange && (
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    aria-label={`${payment.input.title}の未同期支払いを修正`}
                    onClick={() => onEdit(payment)}
                    className="flex min-h-11 touch-manipulation items-center justify-center gap-2 rounded-xl border border-blue-300 bg-white px-3 py-2 text-sm font-bold text-blue-700 transition-colors hover:bg-blue-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-700 focus-visible:ring-offset-2"
                  >
                    <IoPencil aria-hidden="true" size={18} />
                    修正
                  </button>
                  <button
                    type="button"
                    aria-label={`${payment.input.title}の未同期支払いを破棄`}
                    onClick={() => onDiscard(payment)}
                    className="flex min-h-11 touch-manipulation items-center justify-center gap-2 rounded-xl border border-red-300 bg-white px-3 py-2 text-sm font-bold text-red-700 transition-colors hover:bg-red-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-700 focus-visible:ring-offset-2"
                  >
                    <IoCloseSharp aria-hidden="true" size={21} />
                    破棄
                  </button>
                </div>
              )}
            </article>
          );
        })}
      </div>
    </ContentBox>
  );
}
