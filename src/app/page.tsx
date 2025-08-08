"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function Home() {
  const [groupName, setGroupName] = useState("");
  const [memberName, setMemberName] = useState("");
  const [members, setMembers] = useState<string[]>([]);
  const router = useRouter();

  const addMember = () => {
    if (memberName.trim() && !members.includes(memberName)) {
      setMembers([...members, memberName]);
      setMemberName("");
    }
  };

  const deleteMember = (memberToDelete: string) => {
    setMembers(members.filter((member) => member !== memberToDelete));
  };

  const createGroup = () => {
    if (groupName && members.length > 1) {
      router.push("/group");
    } else {
      alert("グループ名と2人以上のメンバーを入力してください");
    }
  };

  return (
    <div className="min-h-screen flex flex-col justify-center items-center bg-gradient-to-b from-blue-100 to-blue-400 p-6">
      <h1 className="text-4xl font-bold text-blue-800 text-center mb-2">
        ワリタビ
      </h1>
      <p className="text-center mb-6 text-blue-600">
        旅行の割り勘を、もっとスマートに。
      </p>
      <div className="w-80 h-48 my-5 flex items-center justify-center">
        <img
          src="/image/travel_icon.png"
          alt="travel icon"
          className="w-full h-full object-contain"
        />
      </div>
      <input
        type="text"
        placeholder="例: 東京観光"
        value={groupName}
        onChange={(e) => setGroupName(e.target.value)}
        className="bg-white rounded-lg p-3 mb-4 w-80 h-10 border"
      />
      <div className="flex items-center mb-3 w-80">
        <input
          type="text"
          placeholder="メンバー名"
          value={memberName}
          onChange={(e) => setMemberName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && addMember()}
          className="flex-1 bg-white rounded-lg p-3 mr-2 border"
        />
        <button
          onClick={addMember}
          className="bg-blue-500 p-3 rounded-lg text-white font-bold"
        >
          ＋
        </button>
      </div>
      <div className="flex flex-row flex-wrap gap-2 mb-6 w-80">
        {members.map((name) => (
          <span key={name} className="bg-blue-100 p-2 rounded-2xl m-1">
            {name}
            <button
              onClick={() => deleteMember(name)}
              className=" p-1  text-red-500 font-bold"
            >
              ×
            </button>
          </span>
        ))}
      </div>
      <button
        onClick={createGroup}
        className="bg-blue-500 p-4 rounded-full text-white font-bold text-base w-80"
      >
        グループを作成
      </button>
    </div>
  );
}
