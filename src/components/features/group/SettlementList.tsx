"use client";

import { IoArrowForward } from "react-icons/io5";
import ContentBox from "@/components/ui/ContentBox";
import { formatCurrency } from "@/lib/formatters";
import type { Member, Settlement } from "@/types";

export default function SettlementList({
  settlements,
  members,
  onComplete,
  disabled,
}: {
  settlements: Settlement[];
  members: Member[];
  onComplete: (settlement: Settlement) => void;
  disabled: boolean;
}) {
  const memberName = (id: string) =>
    members.find((member) => member.id === id)?.name ?? "不明";

  return (
    <ContentBox
      title="精算方法"
      containerClassName="bg-amber-50 border-3 border-yellow-200 w-full max-w-md"
      titleClassName="text-yellow-700"
      bodyClassName="min-h-36 bg-amber-100 border-2 border-yellow-200 py-3"
    >
      {settlements.length > 0 ? (
        settlements.map((settlement) => (
          <button
            type="button"
            key={`${settlement.fromMemberId}:${settlement.toMemberId}`}
            disabled={disabled}
            className="flex justify-between items-center w-full text-left text-sm mb-2 font-bold border-b border-gray-300 pb-2 px-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-500 disabled:opacity-50"
            onClick={() => onComplete(settlement)}
          >
            <span className="flex items-center text-gray-700 min-w-0">
              <span className="truncate">{memberName(settlement.fromMemberId)}</span>
              <IoArrowForward size={15} className="mx-2 flex-shrink-0" />
              <span className="truncate">{memberName(settlement.toMemberId)}</span>
            </span>
            <span className="text-lg text-red-500 whitespace-nowrap ml-2">
              {formatCurrency(settlement.amount)}円
            </span>
          </button>
        ))
      ) : (
        <div className="flex items-center justify-center flex-col h-28 text-gray-500 text-xs font-semibold">
          <p>精算は完了しています 🎉</p>
          <p>支払いが追加されると自動で再計算されます。</p>
        </div>
      )}
      {settlements.length > 0 && (
        <p className="text-[11px] text-center text-amber-800 px-3">
          送金した項目をタップすると、全員の残高へ反映されます。
        </p>
      )}
    </ContentBox>
  );
}
