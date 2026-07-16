"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import ActionButton from "@/components/ui/ActionButton";
import { useGroup } from "@/contexts/GroupContext";
import type { InvitePreview } from "@/types";

export default function JoinGroupPage() {
  const params = useParams<{ token: string }>();
  const router = useRouter();
  const { inspectInvite, joinSharedGroup } = useGroup();
  const [preview, setPreview] = useState<InvitePreview | null>(null);
  const [memberId, setMemberId] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isJoining, setIsJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setIsLoading(true);
    void inspectInvite(params.token).then((result) => {
      if (!active) return;
      if (result.ok) {
        setPreview(result.data);
      } else {
        setError(result.message);
      }
      setIsLoading(false);
    });
    return () => {
      active = false;
    };
  }, [inspectInvite, params.token]);

  const handleJoin = async () => {
    if (!memberId) {
      setError("自分のメンバーを選択してください。");
      return;
    }
    setIsJoining(true);
    setError(null);
    const result = await joinSharedGroup(params.token, memberId);
    setIsJoining(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    router.replace(`/groups/${result.data.groupId}`);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-blue-100 to-blue-400 text-blue-800 font-bold">
        招待リンクを確認しています...
      </div>
    );
  }

  if (!preview) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-blue-100 to-blue-400 p-6 text-center">
        <h1 className="text-2xl font-extrabold text-blue-800 mb-3">
          グループに参加できません
        </h1>
        <p role="alert" className="text-red-600 font-bold mb-5">
          {error ?? "招待リンクが無効です。"}
        </p>
        <ActionButton onClick={() => router.replace("/")} className="max-w-sm">
          ホームへ戻る
        </ActionButton>
      </main>
    );
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-gradient-to-b from-blue-100 to-blue-400 p-6">
      <section className="w-full max-w-md bg-white/70 rounded-2xl p-6 shadow-lg">
        <p className="text-sm font-bold text-blue-600 text-center mb-2">
          招待されています
        </p>
        <h1 className="text-2xl font-extrabold text-blue-800 text-center mb-5">
          {preview.groupName}
        </h1>
        <label htmlFor="joinMember" className="block text-sm font-bold text-gray-700 mb-1">
          あなたは誰ですか？
        </label>
        <select
          id="joinMember"
          value={memberId}
          onChange={(event) => setMemberId(event.target.value)}
          className="w-full p-3 border-2 bg-white border-gray-200 rounded-lg focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-300"
        >
          <option value="">選択してください</option>
          {preview.members.map((member) => (
            <option key={member.id} value={member.id}>
              {member.name}
            </option>
          ))}
        </select>
        <p className="text-xs text-gray-500 mt-2">
          同じ人がスマートフォンとPCの両方から参加しても大丈夫です。
        </p>
        {error && (
          <p role="alert" className="text-sm font-bold text-red-600 mt-4">
            {error}
          </p>
        )}
        <ActionButton onClick={() => void handleJoin()} disabled={isJoining}>
          {isJoining ? "参加しています..." : "このグループに参加"}
        </ActionButton>
      </section>
    </main>
  );
}
