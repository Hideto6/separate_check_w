"use client";

// AddPaymentPage
//  概要:
//    GroupPageの立て替え記録の欄に、新しい記録を追加する画面。
//    ユーザーがタイトル・立て替える人・立て替えられる人・金額を入力し、記録として保存する。
//    入力完了後は前のページ（GroupPage）に戻る。
//    GroupPageの立て替え記録の欄に記録した内容が表示される。
//
//  主な機能:
//    - タイトルの入力（例: タクシー代）
//    - 立て替える人の選択（セレクトボックス）
//    - 金額の入力
//    - 立て替えられる人の複数選択（ボタンのON/OFF切り替え）
//    - 「追加」ボタンで記録を確定し前のページへ戻る
//    - 「戻る」ボタンで前のページへ戻る

import { useRouter } from "next/navigation";
import { useState } from "react";
import { IoChevronBack } from "react-icons/io5";

const members = ["太郎", "秀仁", "あき"];

export default function AddPaymentPage() {
  const router = useRouter();
  const [desc, setDesc] = useState("");
  const [payer, setPayer] = useState(members[0]);
  const [amount, setAmount] = useState("");
  const [beneficiaries, setBeneficiaries] = useState<string[]>([]);

  const toggleBeneficiary = (name: string) => {
    setBeneficiaries((prev) =>
      prev.includes(name) ? prev.filter((b) => b !== name) : [...prev, name]
    );
  };

  const handleSubmit = () => {
    router.back();
  };

  return (
    <div className="min-h-screen flex flex-col items-center bg-blue-50 p-6">
      <div className="w-full max-w-xl">
        <button
          className="mt-5 mb-2 text-blue-900 hover:bg-blue-100 active:bg-blue-100 rounded-full p-2 transition-colors"
          onClick={() => router.back()}
        >
          <IoChevronBack size={28} />
        </button>
        <input
          type="text"
          placeholder="例: タクシー代"
          value={desc}
          onChange={(e) => setDesc(e.target.value)}
          className="bg-white rounded-lg p-3 mb-4 w-full border"
        />
        <div className="text-lg font-semibold mb-2">の立て替え</div>

        <div className="text-lg font-semibold mb-2">立て替える人</div>
        <select
          value={payer}
          onChange={(e) => setPayer(e.target.value)}
          className="bg-white rounded-lg mb-4 p-3 w-full border"
        >
          {members.map((m) => (
            <option value={m} key={m}>
              {m}
            </option>
          ))}
        </select>

        <input
          type="number"
          placeholder="例: 12000"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="bg-white rounded-lg p-3 mb-2 w-full border"
        />
        <div className="text-lg font-semibold mb-4">円</div>

        <div className="text-lg font-semibold mb-2">立て替えられる人</div>
        <div className="flex flex-row flex-wrap gap-2 mb-6">
          {members.map((name) => (
            <button
              type="button"
              key={name}
              onClick={() => toggleBeneficiary(name)}
              className={`p-3 rounded-full font-semibold border ${
                beneficiaries.includes(name)
                  ? "bg-blue-500 text-white"
                  : "bg-white text-gray-700"
              }`}
            >
              {name}
            </button>
          ))}
        </div>

        <button
          onClick={handleSubmit}
          className="bg-blue-500 p-4 rounded-full text-white font-bold text-lg w-full hover:bg-blue-400 active:bg-blue-400 transition-colors"
        >
          追加
        </button>
      </div>
    </div>
  );
}
