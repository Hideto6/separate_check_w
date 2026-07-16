"use client";

import { IoArrowForward, IoCloseSharp } from "react-icons/io5";
import ContentBox from "@/components/ui/ContentBox";
import { formatCurrency } from "@/lib/formatters";
import type { Member, SettlementTransfer } from "@/types";

export default function TransferList({
  transfers,
  members,
  onDelete,
  disabled,
}: {
  transfers: SettlementTransfer[];
  members: Member[];
  onDelete: (transfer: SettlementTransfer) => void;
  disabled: boolean;
}) {
  if (transfers.length === 0) return null;
  const memberName = (id: string | null) =>
    members.find((member) => member.id === id)?.name ?? "不明";

  return (
    <ContentBox
      title="精算履歴"
      containerClassName="bg-emerald-50 border-3 border-emerald-200 w-full max-w-md"
      titleClassName="text-emerald-700"
      bodyClassName="max-h-52 bg-emerald-100 border-2 border-emerald-200"
    >
      {transfers.map((transfer) => (
        <div
          key={transfer.id}
          className="flex items-center justify-between gap-2 px-4 py-3 border-b border-emerald-200 text-sm font-bold text-gray-700"
        >
          <span className="flex items-center min-w-0">
            <span className="truncate">{memberName(transfer.fromMemberId)}</span>
            <IoArrowForward className="mx-2 flex-shrink-0" />
            <span className="truncate">{memberName(transfer.toMemberId)}</span>
          </span>
          <span className="whitespace-nowrap text-emerald-700">
            {formatCurrency(transfer.amount)}円
          </span>
          <button
            type="button"
            aria-label={`${memberName(transfer.fromMemberId)}から${memberName(
              transfer.toMemberId
            )}への精算を取り消す`}
            onClick={() => onDelete(transfer)}
            disabled={disabled}
            className="w-8 h-8 flex items-center justify-center text-red-500 rounded-full hover:bg-red-500 hover:text-white disabled:opacity-50"
          >
            <IoCloseSharp size={20} />
          </button>
        </div>
      ))}
    </ContentBox>
  );
}
