"use client";
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
          className="mt-5 mb-2 text-blue-900 hover:bg-blue-100 rounded-full p-2"
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
          className="bg-blue-500 p-4 rounded-full text-white font-bold text-lg w-full hover:bg-blue-400 active:bg-blue-400"
        >
          追加
        </button>
      </div>
    </div>
  );
}
