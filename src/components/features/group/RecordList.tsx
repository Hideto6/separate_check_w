"use client";

import { FaUser, FaUsers } from "react-icons/fa";
import { IoCloseSharp } from "react-icons/io5";
import { Record } from "@/types";
import { formatCurrency } from "@/lib/formatters";
import ContentBox from "@/components/ui/ContentBox";
import ActionButton from "@/components/ui/ActionButton";

interface RecordListProps {
  records: Record[];
  onDeleteRecord: (id: string) => void;
  onAddRecord: () => void;
}

const RecordList: React.FC<RecordListProps> = ({
  records,
  onDeleteRecord,
  onAddRecord,
}) => {
  return (
    <ContentBox
      title="立て替え一覧"
      containerClassName="bg-blue-50 border-3 border-blue-200 w-full max-w-md"
      titleClassName="text-blue-600"
      bodyClassName="h-80 bg-blue-100 border-2 border-blue-200"
      footer={<ActionButton onClick={onAddRecord}>記録する</ActionButton>}
    >
      {records.length > 0 ? (
        records.map((r) => (
          <div
            key={r.id}
            className="mb-2 py-2 flex items-center justify-between border-b border-gray-300 px-5"
          >
            <div>
              <div className="font-bold text-base mb-2 text-gray-500">
                {r.title}
              </div>
              <div className="text-xs font-bold flex items-center mb-3 text-gray-600">
                <FaUser
                  size={16}
                  className="text-blue-500 mr-4 flex-shrink-0"
                />{" "}
                {r.payer}
              </div>
              <div className="text-xs font-bold flex items-center w-30 text-gray-600">
                <FaUsers
                  size={20}
                  className="text-red-500 mr-3 flex-shrink-0"
                />{" "}
                {r.for.join(", ")}
              </div>
            </div>

            <div className="font-bold text-xl font-extrabold text-gray-600">
              {formatCurrency(r.amount)}円
            </div>
            <button
              onClick={() => onDeleteRecord(r.id)}
              className="w-6 h-6 flex items-center ml-2 justify-center text-red-500 font-bold rounded-full hover:bg-red-500 hover:text-white active:bg-red-600 active:text-white transition-colors"
            >
              <IoCloseSharp size={20} />
            </button>
          </div>
        ))
      ) : (
        <div className="flex items-center justify-center flex-col h-full text-gray-400 text-xs font-semibold">
          <p>下のボタンから</p>
          <p>最初の記録を追加してください。</p>
        </div>
      )}
    </ContentBox>
  );
};

export default RecordList;
