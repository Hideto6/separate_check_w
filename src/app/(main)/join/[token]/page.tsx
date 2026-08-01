"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import ActionButton from "@/components/ui/ActionButton";
import InlineNotice from "@/components/ui/InlineNotice";
import PageShell from "@/components/ui/PageShell";
import StatusPanel from "@/components/ui/StatusPanel";
import { useGroup } from "@/contexts/GroupContext";
import type { InvitePreview } from "@/types";

const focusMemberSelect = () => {
  window.requestAnimationFrame(() => {
    document.getElementById("joinMember")?.focus();
  });
};

export default function JoinGroupPage() {
  const params = useParams<{ token: string }>();
  const token = params.token;
  const router = useRouter();
  const { inspectInvite, joinSharedGroup } = useGroup();
  const [preview, setPreview] = useState<InvitePreview | null>(null);
  const [memberId, setMemberId] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isJoining, setIsJoining] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [memberError, setMemberError] = useState<string | null>(null);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const joinAttemptRef = useRef(0);

  useEffect(() => {
    let active = true;
    joinAttemptRef.current += 1;
    setPreview(null);
    setMemberId("");
    setIsLoading(true);
    setIsJoining(false);
    setLoadError(null);
    setMemberError(null);
    setJoinError(null);

    const loadInvite = async () => {
      try {
        const result = await inspectInvite(token);
        if (!active) return;

        if (result.ok) {
          setPreview(result.data);
        } else {
          setLoadError(result.message);
        }
      } catch {
        if (active) {
          setLoadError(
            "招待リンクを確認できませんでした。通信状況を確認してください。"
          );
        }
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    };

    void loadInvite();
    return () => {
      active = false;
    };
  }, [inspectInvite, retryCount, token]);

  const handleJoin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!memberId) {
      setMemberError("自分のメンバーを選択してください。");
      focusMemberSelect();
      return;
    }

    const attemptId = joinAttemptRef.current + 1;
    joinAttemptRef.current = attemptId;
    setIsJoining(true);
    setMemberError(null);
    setJoinError(null);
    try {
      const result = await joinSharedGroup(token, memberId);
      if (joinAttemptRef.current !== attemptId) return;

      if (!result.ok) {
        setJoinError(result.message);
        return;
      }
      router.replace(`/groups/${result.data.groupId}`);
    } catch {
      if (joinAttemptRef.current === attemptId) {
        setJoinError(
          "グループに参加できませんでした。通信状況を確認して、もう一度お試しください。"
        );
      }
    } finally {
      if (joinAttemptRef.current === attemptId) {
        setIsJoining(false);
      }
    }
  };

  if (isLoading) {
    return (
      <PageShell centered width="md">
        <StatusPanel
          title="招待を確認中"
          message="グループの情報を読み込んでいます..."
          loading
        />
      </PageShell>
    );
  }

  if (!preview) {
    return (
      <PageShell centered width="md">
        <StatusPanel
          title="グループに参加できません"
          message={loadError ?? "招待リンクが無効です。"}
          tone="error"
          actions={
            <>
              <ActionButton onClick={() => setRetryCount((count) => count + 1)}>
                もう一度確認する
              </ActionButton>
              <ActionButton
                variant="secondary"
                onClick={() => router.replace("/")}
              >
                ホームへ戻る
              </ActionButton>
            </>
          }
        />
      </PageShell>
    );
  }

  return (
    <PageShell centered width="md">
      <section className="w-full rounded-2xl bg-white/75 p-5 shadow-lg backdrop-blur-sm sm:p-6">
        <p className="text-center text-sm font-bold text-blue-600">
          グループに招待されています
        </p>
        <h1 className="mt-1 break-words text-center text-2xl font-extrabold text-blue-800">
          {preview.groupName}
        </h1>

        <form
          className="mt-5"
          onSubmit={(event) => void handleJoin(event)}
          aria-busy={isJoining || undefined}
          noValidate
        >
          <fieldset disabled={isJoining} className="min-w-0 space-y-4">
            <legend className="sr-only">参加するメンバーの選択</legend>
            <div>
              <label
                htmlFor="joinMember"
                className="mb-1 block text-sm font-bold text-gray-700"
              >
                あなたは誰ですか？
              </label>
              <select
                id="joinMember"
                value={memberId}
                required
                onChange={(event) => {
                  setMemberId(event.target.value);
                  setMemberError(null);
                  setJoinError(null);
                }}
                disabled={isJoining}
                aria-describedby={`joinMemberHelp${
                  memberError ? " joinMemberError" : ""
                }`}
                aria-invalid={Boolean(memberError)}
                className="min-h-12 w-full rounded-lg border-2 border-gray-200 bg-white px-3 py-2.5 text-base text-gray-800 shadow-sm transition-colors focus-visible:border-blue-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300 disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-500 aria-invalid:border-red-400 aria-invalid:ring-red-200"
              >
                <option value="">選択してください</option>
                {preview.members.map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.name}
                  </option>
                ))}
              </select>
              <p id="joinMemberHelp" className="mt-2 text-xs text-gray-500">
                同じ人がスマートフォンとPCの両方から参加しても大丈夫です。
              </p>
              {memberError && (
                <p
                  id="joinMemberError"
                  role="alert"
                  className="mt-2 text-sm font-bold text-red-600"
                >
                  {memberError}
                </p>
              )}
            </div>

            {joinError && (
              <InlineNotice tone="error">{joinError}</InlineNotice>
            )}

            <div className="space-y-2">
              <ActionButton
                type="submit"
                loading={isJoining}
                loadingLabel="グループに参加しています..."
              >
                このグループに参加
              </ActionButton>
              <ActionButton
                type="button"
                variant="secondary"
                disabled={isJoining}
                onClick={() => router.replace("/")}
              >
                キャンセルしてホームへ
              </ActionButton>
            </div>
          </fieldset>
        </form>
      </section>
    </PageShell>
  );
}
