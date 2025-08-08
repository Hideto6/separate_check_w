"use client";
import { useRouter } from "next/navigation";
import { IoChevronBack } from "react-icons/io5";

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

export default function GroupPage() {
  const router = useRouter();

  return (
    <div className="min-h-screen flex flex-col items-center bg-gradient-to-b from-blue-100 to-blue-400 p-6">
      <div className="w-full max-w-xl">
        <button
          className="mt-5 mb-2 text-blue-900 hover:bg-blue-100 rounded-full p-2"
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

        <div className="flex flex-col items-center bg-white w-full h-56 border-2 border-yellow-200 p-3 rounded-lg mb-4 overflow-y-auto">
          <div className="font-bold text-yellow-600 mb-2 text-base">
            割り勘方法
          </div>
          <div className="w-full">
            {records.map((r) => (
              <div key={r.id} className="text-sm mb-1">
                {r.payer} ➝ {r.for.join("、")}：{r.amount}円
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-col items-center w-full h-56 bg-blue-50 p-3 rounded-lg mb-4 overflow-y-auto">
          <div className="w-full">
            {records.map((r) => (
              <div key={r.id} className="mb-2">
                <div className="font-bold text-base mb-1">{r.title}</div>
                <div className="text-sm">
                  {r.payer} が {r.amount}円
                </div>
                <div className="text-sm">→ {r.for.join("、")}</div>
              </div>
            ))}
          </div>
        </div>

        <button
          className="bg-blue-500 p-4 rounded-full text-white font-bold text-base w-1/2 mx-auto block mt-4 mb-4"
          onClick={() => router.push("/add_payment")}
        >
          記録する
        </button>
      </div>
    </div>
  );
}
