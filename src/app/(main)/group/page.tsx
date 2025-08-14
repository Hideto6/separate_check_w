"use client";

// GroupPage
//  概要:
//    グループの立て替えを記録・管理をする画面。
//    HomePageのテキストに入力したグループ名・メンバーを画面上部に表示。
// 　　　　　　入力した立て替え記録をもとに精算方法を表示し、割り勘の効率化を図る。

//  主な機能:
//    - 「戻る」ボタンで前のページへ戻る
//    - 精算方法の一覧表示（支払人→対象者・金額）
//    - 立て替え記録の一覧表示（タイトル・立て替える人・立て替えられる人・金額・削除ボタン）
//    - 「記録する」ボタンで `/add_payment` ページへ遷移

import { useRouter } from "next/navigation";
import BackButton from "@/components/ui/BackButton";
import { IoArrowForward, IoCloseSharp } from "react-icons/io5";
import { FaUser, FaUsers } from "react-icons/fa";
import { useEffect, useState } from "react";
import { Settlement } from "@/types";
import { calculateSettlement } from "@/lib/calculations";
import { formatCurrency } from "@/lib/formatters";
import { useGroup } from "@/contexts/GroupContext";
import ActionButton from "@/components/ui/ActionButton";
import ContentBox from "@/components/ui/ContentBox";

export default function GroupPage() {
  const router = useRouter();
  const { groupName, members, records, deleteRecord } = useGroup();
  const [settlements, setSettlements] = useState<Settlement[]>([]);

  useEffect(() => {
    if (members.length > 0) {
      const newSettlements = calculateSettlement(records, members);
      setSettlements(newSettlements);
    }
  }, [records, members]);

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-blue-100 to-blue-400 p-6">
      <BackButton className="self-start" />
      <div className="flex flex-col items-center mb-2">
        <h2 className="text-2xl font-extrabold text-blue-800 mb-2">
          {groupName}
        </h2>
        <div className="w-80 mx-2 font-bold text-blue-800 flex flex-row justify-center font-semibold ">
          <div className="mr-1 w-30">メンバー：</div>
          <div className="text-gray-700 font-medium">{members.join("、")}</div>
        </div>
      </div>

      <ContentBox
        title="精算方法"
        containerClassName="bg-amber-50 border-3 border-yellow-200"
        titleClassName="text-yellow-600"
        bodyClassName="h-40 bg-amber-100 border-2 border-yellow-200 py-3"
      >
        {settlements.length > 0 ? (
          settlements.map((s, index) => (
            <div
              key={index}
              className="flex justify-between items-center w-full text-sm mb-2 font-bold border-b border-gray-300 pb-2 px-6"
            >
              <span className="text-gray-700 flex items-center space-x-2">
                <div className="w-12">{s.from}</div>
                <IoArrowForward
                  size={15}
                  color="gray"
                  className="flex-shrink-0"
                />
                <div className="w-15 ml-2">{s.to}</div>
              </span>
              <span className="text-xl text-gray-600 text-right font-extrabold text-red-500">
                {formatCurrency(s.amount)}円
              </span>
            </div>
          ))
        ) : (
          <div className="flex items-center justify-center flex-col h-full text-gray-400 text-xs font-semibold">
            <p>立て替え一覧に記録すると、</p>
            <p>精算方法が表示されます。</p>
          </div>
        )}
      </ContentBox>

      <ContentBox
        title="立て替え一覧"
        containerClassName="bg-blue-50 border-3 border-blue-200"
        titleClassName="text-blue-600"
        bodyClassName="h-80 bg-blue-100 border-2 border-blue-200"
        footer={
          <ActionButton onClick={() => router.push("/add_payment")}>
            記録する
          </ActionButton>
        }
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
                  {r.for.join(",")}
                </div>
              </div>

              <div className="font-bold text-xl font-extrabold text-gray-600">
                {formatCurrency(r.amount)}円
              </div>
              <button
                onClick={() => deleteRecord(r.id)}
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
    </div>
  );
}
