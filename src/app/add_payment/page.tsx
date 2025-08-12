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
import { FaUser, FaUsers } from "react-icons/fa";

const members = ["太郎", "秀仁", "あき", "あいこ", "まさる", "こうたろう"];

export default function AddPaymentPage() {
  const router = useRouter();
  const [desc, setDesc] = useState("");
  const [payer, setPayer] = useState("");
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
    <div className="min-h-screen bg-gradient-to-b from-blue-100 to-blue-400 p-6">
      <button
        className="mt-5 mb-2 text-blue-900 hover:bg-blue-100 active:bg-blue-100 rounded-full p-2 transition-colors"
        onClick={() => router.back()}
      >
        <IoChevronBack size={28} />
      </button>

      <div className="w-full max-w-xl mx-auto">
        <div className="bg-white/80 backdrop-blur-sm p-8 rounded-2xl shadow-lg border border-blue-200">
          <div className="mb-6">
            <label
              htmlFor="description"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              内容：
            </label>
            <input
              id="description"
              type="text"
              placeholder="例: タクシー代"
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              className="bg-white rounded-lg p-3 w-full border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
            />
          </div>

          <div className="mb-6">
            <label
              htmlFor="payer"
              className="flex items-center text-sm font-medium text-gray-700 mb-1"
            >
              <FaUser size={16} className="text-blue-500 mr-2" />
              立て替える人：
            </label>
            <select
              id="payer"
              value={payer}
              onChange={(e) => setPayer(e.target.value)}
              className={`w-full border border-gray-300 bg-white rounded-lg px-3 py-3 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-blue-400 transition ${
                payer ? "text-gray-800" : "text-gray-400"
              }`}
            >
              <option value="" disabled>
                選択してください
              </option>

              {members.map((m) => (
                <option value={m} key={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>

          <div className="mb-6">
            <label
              htmlFor="amount"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              金額：
            </label>
            <div className="flex items-center">
              <input
                id="amount"
                type="number"
                placeholder="例: 12000"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="bg-white rounded-lg p-3 w-full border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
              />
              <span className="ml-2 text-gray-600">円</span>
            </div>
          </div>

          <div className="mb-8">
            <label
              htmlFor="payer"
              className="flex items-center text-sm font-medium text-gray-700 mb-1"
            >
              <FaUsers size={18} className="text-red-500 mr-2" />
              立て替えられる人：
            </label>
            <div className="flex flex-row flex-wrap gap-2">
              {members.map((name) => (
                <button
                  type="button"
                  key={name}
                  onClick={() => toggleBeneficiary(name)}
                  className={`px-4 py-2 rounded-full font-semibold border text-sm transition-colors ${
                    beneficiaries.includes(name)
                      ? "bg-blue-500 text-white border-transparent"
                      : "bg-white text-gray-700 border-gray-300 hover:bg-gray-100"
                  }`}
                >
                  {name}
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={handleSubmit}
            className="bg-blue-500 p-4 rounded-2xl text-white font-bold text-lg w-full hover:bg-blue-600 active:bg-blue-700 transition-colors shadow-md"
          >
            追加
          </button>
        </div>
      </div>
      <div className="w-80 h-48 my-5 flex items-center justify-center">
        <img
          src="/image/wallet_icon.png"
          alt="wallet icon"
          className="w-full h-full object-contain"
        />
      </div>
    </div>
  );
}
