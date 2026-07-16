"use client";

import { useState } from "react";
import { useGroup } from "@/contexts/GroupContext";
import type { GroupSnapshot, MutationResult } from "@/types";

export default function GroupSettings({
  snapshot,
  onDeleted,
}: {
  snapshot: GroupSnapshot;
  onDeleted: () => void;
}) {
  const {
    syncStatus,
    changeMyMember,
    getInviteLink,
    rotateInvite,
    setInviteEnabled,
    deleteSharedGroup,
  } = useGroup();
  const [shareLink, setShareLink] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);
  const isOwner = snapshot.group.role === "owner";
  const isOffline = syncStatus === "offline";

  const showResult = (result: MutationResult, successMessage: string) => {
    setIsError(!result.ok);
    setMessage(result.ok ? successMessage : result.message);
  };

  const handleCopyInvite = async (forceRotate = false) => {
    setBusy("invite");
    const result = forceRotate ? await rotateInvite() : await getInviteLink();
    setBusy(null);
    if (!result.ok) {
      setIsError(true);
      setMessage(result.message);
      return;
    }
    setShareLink(result.data);
    try {
      await navigator.clipboard.writeText(result.data);
      setIsError(false);
      setMessage(
        forceRotate
          ? "新しい招待リンクを発行してコピーしました。"
          : "招待リンクをコピーしました。"
      );
    } catch {
      setIsError(false);
      setMessage("下の招待リンクをコピーしてください。");
    }
  };

  return (
    <details className="w-full max-w-md bg-white/60 rounded-xl shadow-sm mb-6">
      <summary className="cursor-pointer px-4 py-3 font-extrabold text-blue-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded-xl">
        グループ設定
      </summary>
      <div className="px-4 pb-5 space-y-5">
        <div>
          <label htmlFor="currentMember" className="block text-sm font-bold text-gray-700 mb-1">
            あなたのメンバー
          </label>
          <select
            id="currentMember"
            value={snapshot.group.currentMemberId}
            disabled={isOffline || busy !== null}
            onChange={(event) => {
              setBusy("identity");
              void changeMyMember(event.target.value).then((result) => {
                setBusy(null);
                showResult(result, "あなたのメンバーを変更しました。");
              });
            }}
            className="w-full p-2 border-2 bg-white border-gray-200 rounded-lg disabled:opacity-50"
          >
            {snapshot.members.map((member) => (
              <option key={member.id} value={member.id}>
                {member.name}
              </option>
            ))}
          </select>
        </div>

        {isOwner && (
          <>
            <div className="border-t border-blue-200 pt-4">
              <h3 className="text-sm font-bold text-gray-700 mb-2">招待リンク</h3>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={
                    isOffline || busy !== null || !snapshot.group.inviteEnabled
                  }
                  onClick={() => void handleCopyInvite(false)}
                  className="px-3 py-2 bg-blue-500 text-white text-sm font-bold rounded-lg disabled:opacity-50"
                >
                  リンクをコピー
                </button>
                <button
                  type="button"
                  disabled={isOffline || busy !== null}
                  onClick={() => {
                    if (
                      window.confirm(
                        "古い招待リンクは使えなくなります。新しく発行しますか？"
                      )
                    ) {
                      void handleCopyInvite(true);
                    }
                  }}
                  className="px-3 py-2 bg-amber-100 text-amber-800 text-sm font-bold rounded-lg disabled:opacity-50"
                >
                  再発行
                </button>
                <button
                  type="button"
                  disabled={isOffline || busy !== null}
                  onClick={() => {
                    setBusy("inviteEnabled");
                    void setInviteEnabled(!snapshot.group.inviteEnabled).then(
                      (result) => {
                        setBusy(null);
                        showResult(
                          result,
                          snapshot.group.inviteEnabled
                            ? "招待リンクを停止しました。"
                            : "招待リンクを有効にしました。"
                        );
                      }
                    );
                  }}
                  className="px-3 py-2 bg-gray-100 text-gray-700 text-sm font-bold rounded-lg disabled:opacity-50"
                >
                  {snapshot.group.inviteEnabled ? "招待を停止" : "招待を再開"}
                </button>
              </div>
              {shareLink && (
                <input
                  aria-label="招待リンク"
                  readOnly
                  value={shareLink}
                  onFocus={(event) => event.currentTarget.select()}
                  className="w-full mt-2 p-2 text-xs border bg-white border-gray-300 rounded-lg"
                />
              )}
            </div>

            <div className="border-t border-red-200 pt-4">
              <button
                type="button"
                disabled={isOffline || busy !== null}
                onClick={() => {
                  if (
                    !window.confirm(
                      "グループとすべての記録を完全に削除します。元に戻せません。"
                    )
                  ) {
                    return;
                  }
                  setBusy("deleteGroup");
                  void deleteSharedGroup().then((result) => {
                    setBusy(null);
                    if (result.ok) onDeleted();
                    else showResult(result, "");
                  });
                }}
                className="w-full px-3 py-2 bg-red-100 text-red-700 font-bold rounded-lg disabled:opacity-50"
              >
                グループを削除
              </button>
              <p className="text-[11px] text-gray-500 mt-2">
                匿名利用のため、ブラウザデータを消すと作成者権限は復旧できません。
              </p>
            </div>
          </>
        )}

        {message && (
          <p
            role={isError ? "alert" : "status"}
            className={`text-sm font-bold ${isError ? "text-red-600" : "text-green-700"}`}
          >
            {message}
          </p>
        )}
      </div>
    </details>
  );
}
