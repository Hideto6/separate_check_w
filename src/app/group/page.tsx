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

const groupName = "旅行グループ";
const parsedMembers = ["太郎", "秀仁", "あき"];
const records = [
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

interface Settlement {
  from: string;
  to: string;
  amount: number;
}

export default function GroupPage() {
  const router = useRouter();
  const [settlements, setSettlements] = useState<Settlement[]>([]);

  useEffect(() => {
    const calculateSettlement = () => {
      const balances: { [key: string]: number } = {};
      parsedMembers.forEach((member) => (balances[member] = 0)); //各メンバーの収支を0に初期化

      records.forEach((record) => {
        const amountPerPerson = record.amount / record.for.length;
        balances[record.payer] += record.amount; // 立て替えた人の収支を増やす
        record.for.forEach((member) => {
          balances[member] -= amountPerPerson; // 立て替えられた人の収支を減らす
        });
      });

      const debtors = Object.entries(balances) // 収支がマイナスの人（借りている人）
        .filter(([, balance]) => balance < 0)
        .map(([person, balance]) => ({ person, amount: -balance }));
      const creditors = Object.entries(balances) // 収支がプラスの人（貸している人）
        .filter(([, balance]) => balance > 0)
        .map(([person, balance]) => ({ person, amount: balance }));

      const newSettlements: Settlement[] = []; // 新しい精算情報の配列

      while (debtors.length > 0 && creditors.length > 0) {
        const debtor = debtors[0]; // 借りている人の配列の最初の人
        const creditor = creditors[0]; // 貸している人の配列の最初の人
        const amount = Math.min(debtor.amount, creditor.amount); // 借りている人と貸している人のうち、少ない方の金額を取得

        newSettlements.push({
          from: debtor.person,
          to: creditor.person,
          amount: Math.round(amount),
        }); // 新しい精算情報を追加

        debtor.amount -= amount;
        creditor.amount -= amount;

        if (debtor.amount < 0.01) {
          debtors.shift();
        } // 借りている人の金額が0以下になったら配列から削除
        if (creditor.amount < 0.01) {
          creditors.shift();
        } // 貸している人の金額が0以下になったら配列から削除
      }
      setSettlements(newSettlements);
    };

    calculateSettlement();
  }, []);

  return (
    <div className="min-h-screen flex flex-col items-center bg-gradient-to-b from-blue-100 to-blue-400 p-6">
      <div className="w-full max-w-xl">
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

        <div className="flex flex-col items-center bg-white w-full h-70 border-3 border-yellow-200 p-3 rounded-lg mb-4">
          <div className="font-bold text-yellow-600 mb-2 text-base rounded">
            精算方法
          </div>
          <div className="w-full bg-yellow-50 border-2 border-yellow-200 overflow-y-auto py-3">
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

        <div className="flex flex-col items-center w-full h-70 bg-blue-50 p-3 rounded-lg mb-4 border-3 border-blue-200">
          <div className="font-bold text-blue-600 mb-2 text-base rounded">
            立て替え記録
          </div>
          <div className="flex flex-col justify-between w-full bg-blue-100 border-2 border-blue-200 rounded overflow-y-auto">
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
                <button className="w-6 h-6 flex items-center justify-center text-red-500 font-bold p-1 rounded-full hover:bg-red-500 hover:text-white active:bg-red-500 active:text-white transition-colors">
                  <IoCloseSharp size={20} />
                </button>
              </div>
            ))}
          </div>

          <button
            className="bg-blue-500 p-2 rounded-full text-white font-bold text-base w-1/2 mx-auto block my-2 hover:bg-blue-400 active:bg-blue-400 transition-colors"
            onClick={() => router.push("/add_payment")}
          >
            記録する
          </button>
        </div>
      </div>
    </div>
  );
}
