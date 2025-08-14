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
import { useState, useEffect } from "react";
import BackButton from "@/components/ui/BackButton";
import { FaUser, FaUsers } from "react-icons/fa";
import { useGroup } from "@/contexts/GroupContext";
import ActionButton from "@/components/ui/ActionButton";
import TextInput from "@/components/ui/TextInput";
import ContentBox from "@/components/ui/ContentBox";

export default function AddPaymentPage() {
  const router = useRouter();
  const { members, addRecord } = useGroup();

  const [title, setTitle] = useState("");
  const [payer, setPayer] = useState("");
  const [amount, setAmount] = useState("");
  const [beneficiaries, setBeneficiaries] = useState<string[]>([]);

  useEffect(() => {
    if (members.length > 0) {
      setBeneficiaries(members);
    }
  }, [members]);

  const toggleBeneficiary = (name: string) => {
    setBeneficiaries((prev) =>
      prev.includes(name) ? prev.filter((b) => b !== name) : [...prev, name]
    );
  };

  const handleSubmit = () => {
    if (!title) {
      alert("内容を入力してください。");
      return;
    }
    if (!payer) {
      alert("支払う人を選択してください。");
      return;
    }
    if (!amount) {
      alert("金額を入力してください。(半角数字)");
      return;
    }
    if (Number(amount) < 0) {
      alert("金額には0以上の値を入力してください。");
      return;
    }
    if (beneficiaries.length === 0) {
      alert("精算するメンバーを1人以上選択してください。");
      return;
    }

    addRecord({
      title,
      payer,
      amount: Number(amount),
      for: beneficiaries,
    });

    router.back();
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-100 to-blue-400 p-6">
      <BackButton className="self-start" />

      <div className="w-full max-w-xl mx-auto">
        <ContentBox
          title="支払い記録"
          containerClassName="bg-blue-50 border-3 border-blue-200"
          titleClassName="text-lg font-semibold text-blue-600"
          bodyClassName="p-8"
          footer={<ActionButton onClick={handleSubmit}>追加</ActionButton>}
        >
          <div className="mb-6">
            <label
              htmlFor="description"
              className="block text-sm font-medium text-gray-500 mb-1"
            >
              内容：
            </label>
            <TextInput
              id="description"
              placeholder="例: ホテル代"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          <div className="mb-6">
            <label
              htmlFor="payer"
              className="flex items-center text-sm font-medium text-gray-500 mb-1"
            >
              <FaUser size={16} className="text-blue-500 mr-2" />
              支払う人：
            </label>
            <select
              id="payer"
              value={payer}
              onChange={(e) => setPayer(e.target.value)}
              className={`w-full border border-gray-300 bg-white rounded-lg px-3 py-3 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-blue-400 transition ${
                payer ? "text-gray-500" : "text-gray-400"
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
              className="block text-sm font-medium text-gray-500 mb-1"
            >
              金額：
            </label>
            <div className="flex items-center">
              <TextInput
                id="amount"
                type="number"
                placeholder="例: 15000"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
              <span className="ml-2 text-gray-600">円</span>
            </div>
          </div>

          <div className="mb-8">
            <label
              htmlFor="beneficiaries"
              className="flex items-center text-sm font-medium text-gray-500 mb-1"
            >
              <FaUsers size={18} className="text-red-500 mr-2" />
              精算するメンバー：
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
        </ContentBox>
      </div>
      <div className="h-35 m-10 flex items-center justify-end">
        <img
          src="/image/wallet_icon.png"
          alt="wallet icon"
          className="w-auto h-full object-contain"
        />
      </div>
    </div>
  );
}
