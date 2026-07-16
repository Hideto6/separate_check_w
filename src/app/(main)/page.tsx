"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import AddMemberForm from "@/components/features/home/AddMemberForm";
import MemberList from "@/components/features/home/MemberList";
import ActionButton from "@/components/ui/ActionButton";
import TextInput from "@/components/ui/TextInput";
import { useGroup } from "@/contexts/GroupContext";
import {
  clearObsoleteLocalGroupData,
  readRecentGroup,
} from "@/lib/validation";
import type { RecentGroupSummary } from "@/types";

const SelfMemberSelect = ({
  id,
  members,
  value,
  onChange,
}: {
  id: string;
  members: string[];
  value: string;
  onChange: (value: string) => void;
}) => (
  <div className="w-full mb-4">
    <label htmlFor={id} className="block text-sm font-extrabold text-gray-700 mb-1">
      あなたは誰ですか？
    </label>
    <select
      id={id}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="w-full p-3 border-2 bg-white border-gray-200 rounded-lg focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-300"
    >
      <option value="">選択してください</option>
      {members.map((member) => (
        <option key={member} value={member}>
          {member}
        </option>
      ))}
    </select>
  </div>
);

export default function HomePage() {
  const router = useRouter();
  const { createSharedGroup } = useGroup();
  const [groupName, setGroupName] = useState("");
  const [members, setMembers] = useState<string[]>([]);
  const [selfMember, setSelfMember] = useState("");
  const [recentGroup, setRecentGroup] =
    useState<RecentGroupSummary | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCreateAnimating, setIsCreateAnimating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    clearObsoleteLocalGroupData(window.localStorage);
    setRecentGroup(readRecentGroup(window.localStorage));
  }, []);

  const addMember = (memberName: string) => {
    if (members.includes(memberName)) {
      setError("同じ名前のメンバーが既に存在します。");
      return;
    }
    setMembers((current) => [...current, memberName]);
    setError(null);
  };

  const deleteMember = (memberName: string) => {
    setMembers((current) => current.filter((member) => member !== memberName));
    if (selfMember === memberName) {
      setSelfMember("");
    }
  };

  const handleCreate = async () => {
    const normalizedName = groupName.trim();
    if (!normalizedName) {
      setError("グループ名を入力してください。");
      return;
    }
    if (members.length < 2) {
      setError("2人以上のメンバーを追加してください。");
      return;
    }
    if (!selfMember) {
      setError("自分のメンバーを選択してください。");
      return;
    }

    setIsSubmitting(true);
    setIsCreateAnimating(true);
    setError(null);
    const animation = new Promise<void>((resolve) => {
      window.setTimeout(() => {
        setIsCreateAnimating(false);
        resolve();
      }, 500);
    });
    const result = await createSharedGroup(normalizedName, members, selfMember);
    await animation;
    setIsSubmitting(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    router.push(`/groups/${result.data.groupId}`);
  };

  return (
    <main className="min-h-screen flex flex-col items-center bg-gradient-to-b from-blue-100 to-blue-400 p-6 py-10">
      <h1 className="text-4xl font-extrabold text-blue-800 text-center mb-2">
        ワリタビ
      </h1>
      <p className="text-center mb-4 text-blue-600 italic">
        旅行の割り勘を、みんなでスマートに。
      </p>
      <div className="w-72 h-40 mb-5 flex items-center justify-center">
        <Image
          src="/image/travel_icon.png"
          alt="旅行を楽しむ人たち"
          width={850}
          height={521}
          priority
          className="w-full h-full object-contain"
        />
      </div>

      <section className="w-full max-w-md bg-white/45 backdrop-blur-sm rounded-2xl p-5 shadow-md mb-6">
        <h2 className="text-xl font-extrabold text-blue-800 mb-4 text-center">
          グループ作成
        </h2>
        <div className="w-full mb-4">
          <label htmlFor="groupName" className="block text-sm font-extrabold text-gray-700 mb-1">
            グループ名：
          </label>
          <TextInput
            id="groupName"
            placeholder="例：東京旅行"
            value={groupName}
            onChange={(event) => setGroupName(event.target.value)}
          />
        </div>
        <div className="[&>form]:w-full [&>div]:w-full">
          <AddMemberForm onAddMember={addMember} />
          <MemberList members={members} onDeleteMember={deleteMember} />
        </div>
        {members.length >= 2 && (
          <SelfMemberSelect
            id="selfMember"
            members={members}
            value={selfMember}
            onChange={setSelfMember}
          />
        )}
        {error && (
          <p role="alert" className="text-sm font-bold text-red-600 mb-2">
            {error}
          </p>
        )}
        <ActionButton
          onClick={() => void handleCreate()}
          disabled={isSubmitting}
          className={isCreateAnimating ? "animate-ping" : ""}
        >
          {isSubmitting ? "作成しています..." : "グループを作成"}
        </ActionButton>
      </section>

      {recentGroup && (
        <section className="w-full max-w-md bg-white/55 backdrop-blur-sm rounded-2xl p-5 shadow-md mb-6">
          <h2 className="text-xl font-extrabold text-blue-800 mb-4 text-center">
            直近のグループ
          </h2>

          <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-4">
            <p className="text-lg font-extrabold text-blue-800 break-words">
              {recentGroup.groupName}
            </p>
            <ActionButton
              onClick={() => router.push(`/groups/${recentGroup.groupId}`)}
              disabled={isSubmitting}
            >
              グループを開く
            </ActionButton>
          </div>
        </section>
      )}
    </main>
  );
}
