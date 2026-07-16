"use client";

import { FaUser, FaUsers } from "react-icons/fa";
import { IoCloseSharp, IoPencil } from "react-icons/io5";
import ContentBox from "@/components/ui/ContentBox";
import ActionButton from "@/components/ui/ActionButton";
import { formatCurrency } from "@/lib/formatters";
import type { Member, PaymentRecord } from "@/types";

export default function RecordList({
  payments,
  members,
  onDelete,
  onEdit,
  onAdd,
  disabled,
}: {
  payments: PaymentRecord[];
  members: Member[];
  onDelete: (payment: PaymentRecord) => void;
  onEdit: (payment: PaymentRecord) => void;
  onAdd: () => void;
  disabled: boolean;
}) {
  const memberName = (id: string | null) =>
    members.find((member) => member.id === id)?.name ?? "不明";

  return (
    <ContentBox
      title="立て替え一覧"
      containerClassName="bg-blue-50 border-3 border-blue-200 w-full max-w-md"
      titleClassName="text-blue-600"
      bodyClassName="max-h-96 bg-blue-100 border-2 border-blue-200"
      footer={
        <ActionButton onClick={onAdd} disabled={disabled}>
          記録する
        </ActionButton>
      }
    >
      {payments.length > 0 ? (
        payments.map((payment) => (
          <article
            key={payment.id}
            className="py-3 flex items-center justify-between border-b border-gray-300 px-4 gap-2"
          >
            <div className="min-w-0 flex-1">
              <h3 className="font-bold text-base mb-2 text-gray-600 truncate">
                {payment.title}
              </h3>
              <div className="text-xs font-bold flex items-center mb-2 text-gray-600">
                <FaUser size={15} className="text-blue-500 mr-2 flex-shrink-0" />
                {memberName(payment.payerMemberId)}
              </div>
              <div className="text-xs font-bold flex items-start text-gray-600">
                <FaUsers size={17} className="text-red-500 mr-2 flex-shrink-0" />
                <span>
                  {payment.beneficiaryMemberIds.map(memberName).join(", ")}
                </span>
              </div>
              {payment.createdByMemberId && (
                <p className="text-[10px] text-gray-400 mt-2">
                  登録: {memberName(payment.createdByMemberId)}
                </p>
              )}
            </div>
            <div className="font-extrabold text-lg text-gray-700 whitespace-nowrap">
              {formatCurrency(payment.amount)}円
            </div>
            <div className="flex flex-col gap-1">
              <button
                type="button"
                aria-label={`${payment.title}を編集`}
                onClick={() => onEdit(payment)}
                disabled={disabled}
                className="w-8 h-8 flex items-center justify-center text-blue-600 rounded-full hover:bg-blue-500 hover:text-white disabled:opacity-50"
              >
                <IoPencil size={17} />
              </button>
              <button
                type="button"
                aria-label={`${payment.title}を削除`}
                onClick={() => onDelete(payment)}
                disabled={disabled}
                className="w-8 h-8 flex items-center justify-center text-red-500 rounded-full hover:bg-red-500 hover:text-white disabled:opacity-50"
              >
                <IoCloseSharp size={20} />
              </button>
            </div>
          </article>
        ))
      ) : (
        <div className="flex items-center justify-center flex-col h-40 text-gray-400 text-xs font-semibold">
          <p>下のボタンから</p>
          <p>最初の記録を追加してください。</p>
        </div>
      )}
    </ContentBox>
  );
}
