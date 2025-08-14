"use client";

// HomePage
//  概要:
//    グループ作成画面。
//    ユーザーがグループ名とメンバー名を入力し、2人以上のメンバーを追加して旅行やイベントの割り勘記録に使うグループを作成する。
//    作成したグループは　GroupPage　画面上部で表示、記録、精算の際に参照される。
//
//  主な機能:
//    - グループ名の入力
//    - メンバー名の入力と追加（Enterキーまたは追加ボタン）
//    - メンバーの削除
//    - 「グループを作成」ボタンで /group ページへ遷移（条件: グループ名あり＆メンバー2人以上）
//    - 条件を満たさない場合はアラート表示

import { useState } from "react";
import { useRouter } from "next/navigation";
import { IoAddOutline, IoCloseSharp } from "react-icons/io5";
import { useGroup } from "@/contexts/GroupContext"; // カスタムフックをインポート

export default function HomePage() {
  // このページ内での入力状態を管理するためのローカルstate
  const [localGroupName, setLocalGroupName] = useState("");
  const [memberName, setMemberName] = useState("");
  const [localMembers, setLocalMembers] = useState<string[]>([]);

  const router = useRouter();
  const { setGroupName, setMembers } = useGroup(); // Contextから更新関数を取得

  const addMember = () => {
    if (memberName.trim() && !localMembers.includes(memberName)) {
      setLocalMembers([...localMembers, memberName]);
      setMemberName("");
    }
  };

  const deleteMember = (memberToDelete: string) => {
    setLocalMembers(localMembers.filter((member) => member !== memberToDelete));
  };

  const createGroup = () => {
    if (localGroupName && localMembers.length > 1) {
      // 「グループを作成」ボタンが押されたら、Contextの状態を更新
      setGroupName(localGroupName);
      setMembers(localMembers);
      router.push("/group");
    } else {
      alert("グループ名と2人以上のメンバーを入力してください");
    }
  };

  return (
    <div className="min-h-screen flex flex-col justify-center items-center bg-gradient-to-b from-blue-100 to-blue-400 p-6">
      <h1 className="text-4xl font-extrabold text-blue-800 text-center mb-2">
        ワリタビ
      </h1>
      <p className="text-center mb-6 text-blue-600 italic">
        旅行の割り勘を、もっとスマートに。
      </p>
      <div className="w-80 h-48 my-5 flex items-center justify-center">
        <img
          src="/image/travel_icon.png"
          alt="travel icon"
          className="w-full h-full object-contain"
        />
      </div>
      <div className="w-80 mb-4">
        <label
          htmlFor="groupName"
          className="block text-sm font-extrabold text-gray-700 mb-1"
        >
          グループ名：
        </label>
        <input
          id="groupName"
          type="text"
          placeholder="例：東京観光"
          value={localGroupName}
          onChange={(e) => setLocalGroupName(e.target.value)}
          className="bg-white rounded-lg p-3 w-full h-10 border border-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
        />
      </div>
      <div className="w-80">
        <label
          htmlFor="memberName"
          className="block text-sm font-extrabold text-gray-700 mb-1"
        >
          メンバー名：
        </label>
        <div className="flex items-center mb-3">
          <input
            id="memberName"
            type="text"
            placeholder="例：太郎"
            value={memberName}
            onChange={(e) => setMemberName(e.target.value)}
            className="flex-1 bg-white rounded-lg p-3 mr-2 border border-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
          />
          <button
            onClick={addMember}
            className="bg-blue-500 p-3 rounded-lg text-white font-bold hover:bg-blue-400 active:bg-blue-400 transition-colors"
          >
            <IoAddOutline size={25} />
          </button>
        </div>
      </div>
      <div className="flex flex-row flex-wrap gap-1 mb-6 w-80">
        {localMembers.map((name) => (
          <span
            key={name}
            className="flex items-center border border-blue-300 bg-blue-50 rounded-2xl px-3 py-2 shadow-sm hover:shadow-md transition-shadow font-bold text-gray-600"
          >
            {name}
            <button
              onClick={() => deleteMember(name)}
              className=" w-6 h-6 flex items-center ml-2 justify-center text-red-500 font-bold rounded-full hover:bg-red-500 hover:text-white active:bg-red-600 active:text-white transition-colors"
            >
              <IoCloseSharp size={20} />
            </button>
          </span>
        ))}
      </div>
      <button
        onClick={createGroup}
        className="bg-blue-500 p-4 rounded-full text-white font-bold text-base w-80 hover:bg-blue-400 active:bg-blue-400 transition-colors"
      >
        グループを作成
      </button>
    </div>
  );
}
