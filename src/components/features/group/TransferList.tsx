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
  disabledReason,
}: {
  transfers: SettlementTransfer[];
  members: Member[];
  onDelete: (transfer: SettlementTransfer) => void;
  disabled: boolean;
  disabledReason?: string;
}) {
  if (transfers.length === 0) return null;
  const memberName = (id: string | null) =>
    members.find((member) => member.id === id)?.name ?? "不明";

  return (
    <ContentBox
      title="精算履歴"
      containerClassName="w-full border-3 border-emerald-200 bg-emerald-50"
      titleClassName="text-emerald-700"
      bodyClassName="border-2 border-emerald-200 bg-emerald-100"
    >
      {transfers.map((transfer) => (
        <div
          key={transfer.id}
          className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b border-emerald-200 px-4 py-3 text-sm font-bold text-gray-700 last:border-b-0"
        >
          <span className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center">
            <span className="[overflow-wrap:anywhere]">
              {memberName(transfer.fromMemberId)}
            </span>
            <IoArrowForward
              aria-hidden="true"
              className="mx-2 shrink-0"
            />
            <span className="[overflow-wrap:anywhere]">
              {memberName(transfer.toMemberId)}
            </span>
          </span>
          <div className="flex min-w-0 items-center justify-end gap-1">
            <span className="max-w-28 text-right tabular-nums text-emerald-700 [overflow-wrap:anywhere]">
              {formatCurrency(transfer.amount)}円
            </span>
            <button
              type="button"
              aria-label={`${memberName(transfer.fromMemberId)}から${memberName(
                transfer.toMemberId
              )}への精算を取り消す`}
              aria-describedby={
                disabledReason ? "group-offline-reason" : undefined
              }
              title={disabledReason}
              onClick={() => onDelete(transfer)}
              disabled={disabled}
              className="flex min-h-11 min-w-11 touch-manipulation items-center justify-center rounded-full text-red-500 transition-colors hover:bg-red-500 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-700 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <IoCloseSharp aria-hidden="true" size={22} />
            </button>
          </div>
        </div>
      ))}
    </ContentBox>
  );
}
