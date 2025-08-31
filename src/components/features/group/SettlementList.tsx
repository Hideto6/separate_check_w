"use client";

import { IoArrowForward } from "react-icons/io5";
import { formatCurrency } from "@/lib/formatters";
import ContentBox from "@/components/ui/ContentBox";
import { SettlementListProps } from "@/types";

const SettlementList: React.FC<SettlementListProps> = ({
  settlements,
  completedSettlements,
  animatedSettlement,
  onSettlementClick,
}) => {
  return (
    <ContentBox
      title="精算方法"
      containerClassName="bg-amber-50 border-3 border-yellow-200 w-full max-w-md"
      titleClassName="text-yellow-600"
      bodyClassName="h-40 bg-amber-100 border-2 border-yellow-200 py-3"
    >
      {settlements.length > 0 ? (
        settlements.map((s, index) => {
          const isCompleted = completedSettlements.includes(index);
          return (
            <div
              key={index}
              className={`relative flex justify-between items-center w-full text-sm mb-2 font-bold border-b border-gray-300 pb-2 px-6 cursor-pointer ${
                isCompleted ? "text-gray-400" : ""
              }`}
              onClick={() => onSettlementClick(index)}
            >
              <span
                className={`flex items-center space-x-2 ${
                  isCompleted ? "text-gray-400" : "text-gray-700"
                }`}
              >
                <div className="w-12">{s.from}</div>
                <IoArrowForward
                  size={15}
                  color={isCompleted ? "lightgray" : "gray"}
                  className="flex-shrink-0"
                />
                <div className="w-15 ml-2">{s.to}</div>
              </span>
              {isCompleted ? (
                <span className="text-lg font-bold text-green-500">
                  完了！🎉
                </span>
              ) : (
                <span className="text-xl text-gray-600 text-right font-extrabold text-red-500">
                  {formatCurrency(s.amount)}円
                </span>
              )}

              {animatedSettlement === index && (
                <div className="absolute inset-0 flex justify-center items-center pointer-events-none">
                  <span className="text-3xl animate-fade-in-out">🎉</span>
                </div>
              )}
            </div>
          );
        })
      ) : (
        <div className="flex items-center justify-center flex-col h-full text-gray-400 text-xs font-semibold">
          <p>立て替え一覧に記録すると、</p>
          <p>精算方法が表示されます。</p>
        </div>
      )}
    </ContentBox>
  );
};

export default SettlementList;
