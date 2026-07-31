"use client";

import { IoArrowForward } from "react-icons/io5";
import ContentBox from "@/components/ui/ContentBox";
import { formatCurrency } from "@/lib/formatters";
import type { Member, Settlement } from "@/types";

export default function SettlementList({
  settlements,
  members,
  paymentCount,
  onComplete,
  disabled,
  disabledReason,
}: {
  settlements: Settlement[];
  members: Member[];
  paymentCount: number;
  onComplete: (settlement: Settlement) => void;
  disabled: boolean;
  disabledReason?: string;
}) {
  const memberName = (id: string) =>
    members.find((member) => member.id === id)?.name ?? "不明";

  return (
    <ContentBox
      title="精算方法"
      containerClassName="w-full border-3 border-yellow-200 bg-amber-50"
      titleClassName="text-yellow-700"
      bodyClassName="min-h-36 border-2 border-yellow-200 bg-amber-100 py-3"
    >
      {settlements.length > 0 ? (
        settlements.map((settlement) => (
          <button
            type="button"
            key={`${settlement.fromMemberId}:${settlement.toMemberId}`}
            disabled={disabled}
            aria-label={`${memberName(settlement.fromMemberId)}さんから${memberName(
              settlement.toMemberId
            )}さんへ${formatCurrency(settlement.amount)}円を精算済みにする`}
            aria-describedby={
              disabledReason ? "group-offline-reason" : undefined
            }
            title={disabledReason}
            className="grid min-h-11 w-full touch-manipulation grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b border-yellow-200 px-4 py-3 text-left text-sm font-bold last-of-type:border-b-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-600 focus-visible:ring-inset disabled:cursor-not-allowed disabled:opacity-50"
            onClick={() => onComplete(settlement)}
          >
            <span className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center text-gray-700">
              <span className="[overflow-wrap:anywhere]">
                {memberName(settlement.fromMemberId)}
              </span>
              <IoArrowForward
                aria-hidden="true"
                size={16}
                className="mx-2 shrink-0"
              />
              <span className="[overflow-wrap:anywhere]">
                {memberName(settlement.toMemberId)}
              </span>
            </span>
            <span className="max-w-32 text-right text-lg tabular-nums text-red-600 [overflow-wrap:anywhere]">
              {formatCurrency(settlement.amount)}円
            </span>
          </button>
        ))
      ) : (
        <div className="flex min-h-28 flex-col items-center justify-center px-4 py-6 text-center text-sm font-semibold text-gray-600">
          {paymentCount === 0 ? (
            <>
              <p>支払い記録はまだありません。</p>
              <p>支払いを記録すると精算方法が表示されます。</p>
            </>
          ) : (
            <>
              <p>精算は完了しています 🎉</p>
              <p>支払いを追加・変更すると自動で再計算されます。</p>
            </>
          )}
        </div>
      )}
      {settlements.length > 0 && (
        <p className="px-3 pt-3 text-center text-xs font-semibold text-amber-800">
          送金した項目をタップすると、全員の残高へ反映されます。
        </p>
      )}
    </ContentBox>
  );
}
