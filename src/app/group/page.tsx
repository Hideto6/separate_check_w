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
import { IoChevronBack, IoArrowForward, IoCloseSharp } from "react-icons/io5";
import { FaUser, FaUsers } from "react-icons/fa";
import { useEffect, useState } from "react";
import { Settlement, Record } from "@/types";
import { calculateSettlement } from "@/lib/calculations";

const groupName = "旅行グループ";
const parsedMembers = ["太郎", "秀仁", "あき"];
const records: Record[] = [
  {
    id: "1",
    title: "タクシー代",
    payer: "秀仁",
    amount: 2000,
    for: ["あき"],
  },
  {
    id: "2",
    title: "宿代",
    payer: "あき",
    amount: 12000,
    for: ["太郎", "秀仁", "あき"],
  },
];

export default function GroupPage() {
  const router = useRouter();
  const [settlements, setSettlements] = useState<Settlement[]>([]);

  useEffect(() => {
    const newSettlements = calculateSettlement(records, parsedMembers);
    setSettlements(newSettlements);
  }, [records, parsedMembers]);

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-blue-100 to-blue-400 p-6">
      <button
        className="mt-5 mb-2 text-blue-900 hover:bg-blue-100 active:bg-blue-100 rounded-full p-2 transition-colors"
        onClick={() => router.back()}
      >
        <IoChevronBack size={28} />
      </button>
      <div className="flex flex-col items-center mb-2">
        <h2 className="text-2xl font-bold text-blue-800 mb-2">{groupName}</h2>
        <div className="mb-2 font-bold text-blue-800">
          メンバー：{parsedMembers.join("、")}
        </div>
      </div>

      <div className="flex flex-col items-center bg-white w-full h-70 border-3 border-yellow-200 p-3 rounded-2xl mb-4 shadow-md">
        <div className="font-bold text-yellow-600 mb-2 text-base">精算方法</div>
        <div className="w-full h-55 bg-yellow-50 border-2 border-yellow-200 overflow-y-auto py-3 rounded-2xl">
          {settlements.map((s, index) => (
            <div
              key={index}
              className="flex justify-between items-center w-full text-sm mb-2 font-bold border-b border-gray-300 pb-2 px-6"
            >
              <span className="text-gray-700 flex items-center space-x-2">
                <div className="w-7">{s.from}</div>
                <IoArrowForward
                  size={15}
                  color="gray"
                  className="flex-shrink-0"
                />
                <div className="w-26 ml-2">{s.to}</div>
              </span>
              <span className="text-xl text-gray-600 text-right font-extrabold text-red-500">
                {s.amount}円
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-col items-center w-full h-70 bg-blue-50 p-3 rounded-2xl mb-4 border-3 border-blue-200 shadow-md">
        <div className="font-bold text-blue-600 mb-2 text-base">
          立て替え記録
        </div>
        <div className="flex flex-col justify-between w-full h-40 bg-blue-100 border-2 border-blue-200 rounded-2xl overflow-y-auto">
          {records.map((r) => (
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
                {r.amount}円
              </div>
              <button className="w-6 h-6 flex items-center ml-2 justify-center text-red-500 font-bold rounded-full hover:bg-red-500 hover:text-white active:bg-red-600 active:text-white transition-colors">
                <IoCloseSharp size={20} />
              </button>
            </div>
          ))}
        </div>

        <button
          className="bg-blue-500 p-2 rounded-full text-white font-bold text-base w-1/2 block mt-4 hover:bg-blue-400 active:bg-blue-400 transition-colors"
          onClick={() => router.push("/add_payment")}
        >
          記録する
        </button>
      </div>
    </div>
  );
}
