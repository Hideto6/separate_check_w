"use client";

import { useState, useEffect } from "react";
import { FaUser, FaUsers } from "react-icons/fa";
import ActionButton from "@/components/ui/ActionButton";
import TextInput from "@/components/ui/TextInput";
import ContentBox from "@/components/ui/ContentBox";
import { Record } from "@/types";

interface AddPaymentFormProps {
  members: string[];
  addRecord: (record: Omit<Record, "id">) => void;
  onSuccess: () => void;
}

export default function AddPaymentForm({
  members,
  addRecord,
  onSuccess,
}: AddPaymentFormProps) {
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

    onSuccess();
  };

  return (
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
  );
}
