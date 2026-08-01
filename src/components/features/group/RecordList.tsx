"use client";

import { FaUser, FaUsers } from "react-icons/fa";
import { IoCloseSharp, IoPencil } from "react-icons/io5";
import ContentBox from "@/components/ui/ContentBox";
import { formatCurrency } from "@/lib/formatters";
import type { Member, PaymentRecord } from "@/types";

export default function RecordList({
  payments,
  members,
  onDelete,
  onEdit,
  disabled,
  disabledReason,
}: {
  payments: PaymentRecord[];
  members: Member[];
  onDelete: (payment: PaymentRecord) => void;
  onEdit: (payment: PaymentRecord) => void;
  disabled: boolean;
  disabledReason?: string;
}) {
  const memberName = (id: string | null) =>
    members.find((member) => member.id === id)?.name ?? "不明";

  return (
    <ContentBox
      title="支払い記録"
      containerClassName="w-full border-3 border-blue-200 bg-blue-50"
      titleClassName="text-blue-600"
      bodyClassName="border-2 border-blue-200 bg-blue-100"
    >
      {payments.length > 0 ? (
        payments.map((payment) => (
          <article
            key={payment.id}
            className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-2 border-b border-blue-200 px-4 py-3 last:border-b-0"
          >
            <div className="min-w-0 flex-1">
              <h3 className="mb-2 text-base font-bold text-gray-700 [overflow-wrap:anywhere]">
                {payment.title}
              </h3>
              <div className="mb-2 flex min-w-0 items-start text-xs font-bold text-gray-600">
                <FaUser
                  aria-hidden="true"
                  size={15}
                  className="mr-2 shrink-0 text-blue-500"
                />
                <span className="[overflow-wrap:anywhere]">
                  {memberName(payment.payerMemberId)}
                </span>
              </div>
              <div className="flex min-w-0 items-start text-xs font-bold text-gray-600">
                <FaUsers
                  aria-hidden="true"
                  size={17}
                  className="mr-2 shrink-0 text-red-500"
                />
                <span className="[overflow-wrap:anywhere]">
                  {payment.beneficiaryMemberIds.map(memberName).join(", ")}
                </span>
              </div>
              {payment.createdByMemberId && (
                <p className="mt-2 text-xs text-gray-500 [overflow-wrap:anywhere]">
                  登録: {memberName(payment.createdByMemberId)}
                </p>
              )}
            </div>
            <div className="flex min-w-0 flex-col items-end gap-2">
              <p className="max-w-32 text-right text-lg font-extrabold tabular-nums text-gray-700 [overflow-wrap:anywhere]">
                {formatCurrency(payment.amount)}円
              </p>
              <div className="flex gap-1">
                <button
                  type="button"
                  aria-label={`${payment.title}を編集`}
                  aria-describedby={
                    disabledReason ? "group-offline-reason" : undefined
                  }
                  title={disabledReason}
                  onClick={() => onEdit(payment)}
                  disabled={disabled}
                  className="flex min-h-11 min-w-11 touch-manipulation items-center justify-center rounded-full text-blue-600 transition-colors hover:bg-blue-500 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-700 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <IoPencil aria-hidden="true" size={18} />
                </button>
                <button
                  type="button"
                  aria-label={`${payment.title}を削除`}
                  aria-describedby={
                    disabledReason ? "group-offline-reason" : undefined
                  }
                  title={disabledReason}
                  onClick={() => onDelete(payment)}
                  disabled={disabled}
                  className="flex min-h-11 min-w-11 touch-manipulation items-center justify-center rounded-full text-red-500 transition-colors hover:bg-red-500 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-700 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <IoCloseSharp aria-hidden="true" size={22} />
                </button>
              </div>
            </div>
          </article>
        ))
      ) : (
        <div className="flex min-h-32 flex-col items-center justify-center px-4 py-8 text-center text-sm font-semibold text-gray-500">
          <p>支払い記録はまだありません。</p>
          <p>上の「支払いを記録」から追加できます。</p>
        </div>
      )}
    </ContentBox>
  );
}
