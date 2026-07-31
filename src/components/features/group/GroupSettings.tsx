"use client";

import { useState } from "react";
import { IoChevronDown, IoChevronForward } from "react-icons/io5";
import ActionButton from "@/components/ui/ActionButton";
import { useGroup } from "@/contexts/GroupContext";
import type { GroupSnapshot } from "@/types";

type NoticeTone = "success" | "warning" | "error";

export default function GroupSettings({
  snapshot,
  disabled,
  disabledReason,
  onActionStart,
  onNotice,
  onDeleted,
}: {
  snapshot: GroupSnapshot;
  disabled: boolean;
  disabledReason?: string;
  onActionStart: () => void;
  onNotice: (message: string, tone: NoticeTone) => void;
  onDeleted: () => void;
}) {
  const {
    syncStatus,
    changeMyMember,
    rotateInvite,
    setInviteEnabled,
    deleteSharedGroup,
  } = useGroup();
  const [busy, setBusy] = useState<string | null>(null);
  const isOwner = snapshot.group.role === "owner";
  const isOffline = syncStatus === "offline";
  const controlsDisabled = disabled || isOffline || busy !== null;

  const handleChangeMember = async (memberId: string) => {
    onActionStart();
    setBusy("identity");
    try {
      const result = await changeMyMember(memberId);
      onNotice(
        result.ok ? "あなたのメンバーを変更しました。" : result.message,
        result.ok ? "success" : "error"
      );
    } catch {
      onNotice(
        "メンバーを変更できませんでした。通信状態を確認して、もう一度お試しください。",
        "error"
      );
    } finally {
      setBusy(null);
    }
  };

  const handleRotateInvite = async () => {
    onActionStart();
    if (
      !window.confirm(
        "以前の招待リンクは使えなくなります。新しく発行しますか？"
      )
    ) {
      return;
    }

    setBusy("rotateInvite");
    try {
      const result = await rotateInvite();
      onNotice(
        result.ok
          ? "新しい招待リンクを発行しました。以前のリンクは使えません。"
          : result.message,
        result.ok ? "success" : "error"
      );
    } catch {
      onNotice(
        "招待リンクを再発行できませんでした。通信状態を確認して、もう一度お試しください。",
        "error"
      );
    } finally {
      setBusy(null);
    }
  };

  const handleToggleInvite = async () => {
    onActionStart();
    setBusy("inviteEnabled");
    try {
      const result = await setInviteEnabled(!snapshot.group.inviteEnabled);
      onNotice(
        result.ok
          ? snapshot.group.inviteEnabled
            ? "招待リンクを停止しました。"
            : "招待リンクを再開しました。"
          : result.message,
        result.ok ? "success" : "error"
      );
    } catch {
      onNotice(
        "招待設定を変更できませんでした。通信状態を確認して、もう一度お試しください。",
        "error"
      );
    } finally {
      setBusy(null);
    }
  };

  const handleDeleteGroup = async () => {
    onActionStart();
    if (
      !window.confirm(
        "グループとすべての記録を完全に削除します。元に戻せません。"
      )
    ) {
      return;
    }

    setBusy("deleteGroup");
    try {
      const result = await deleteSharedGroup();
      if (result.ok) {
        onDeleted();
        return;
      }
      onNotice(result.message, "error");
    } catch {
      onNotice(
        "グループを削除できませんでした。通信状態を確認して、もう一度お試しください。",
        "error"
      );
    } finally {
      setBusy(null);
    }
  };

  return (
    <details className="group w-full rounded-2xl border-2 border-blue-200 bg-white/60 shadow-md backdrop-blur-sm">
      <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 rounded-2xl px-4 py-3 font-extrabold text-blue-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-700 focus-visible:ring-offset-2 [&::-webkit-details-marker]:hidden">
        <span>グループ設定</span>
        <span
          aria-hidden="true"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-50 text-blue-700"
        >
          <IoChevronForward size={20} className="group-open:hidden" />
          <IoChevronDown size={20} className="hidden group-open:block" />
        </span>
      </summary>
      <div className="space-y-5 border-t border-blue-100 px-4 py-5">
          <div>
            <label
              htmlFor="currentMember"
              className="mb-1 block text-sm font-bold text-gray-700"
            >
              あなたのメンバー
            </label>
            <select
              id="currentMember"
              value={snapshot.group.currentMemberId}
              disabled={controlsDisabled}
              aria-describedby={isOffline ? "group-offline-reason" : undefined}
              title={isOffline ? disabledReason : undefined}
              onChange={(event) => void handleChangeMember(event.target.value)}
              className="min-h-11 w-full rounded-lg border-2 border-gray-200 bg-white px-3 py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
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
              <section
                aria-labelledby="invite-settings-heading"
                className="border-t border-blue-200 pt-4"
              >
                <h3
                  id="invite-settings-heading"
                  className="mb-2 text-sm font-extrabold text-gray-700"
                >
                  招待リンクの管理
                </h3>
                <div className="grid grid-cols-2 gap-2">
                  <ActionButton
                    variant="secondary"
                    disabled={controlsDisabled}
                    loading={busy === "rotateInvite"}
                    loadingLabel="発行中..."
                    aria-describedby={
                      isOffline ? "group-offline-reason" : undefined
                    }
                    title={isOffline ? disabledReason : undefined}
                    onClick={() => void handleRotateInvite()}
                    className="px-2 text-sm"
                  >
                    リンクを再発行
                  </ActionButton>
                  <ActionButton
                    variant="secondary"
                    disabled={controlsDisabled}
                    loading={busy === "inviteEnabled"}
                    loadingLabel="変更中..."
                    aria-describedby={
                      isOffline ? "group-offline-reason" : undefined
                    }
                    title={isOffline ? disabledReason : undefined}
                    onClick={() => void handleToggleInvite()}
                    className="px-2 text-sm"
                  >
                    {snapshot.group.inviteEnabled
                      ? "招待を停止"
                      : "招待を再開"}
                  </ActionButton>
                </div>
              </section>

              <section
                aria-labelledby="danger-settings-heading"
                className="border-t border-red-200 pt-4"
              >
                <h3
                  id="danger-settings-heading"
                  className="mb-2 text-sm font-extrabold text-red-700"
                >
                  グループの削除
                </h3>
                <ActionButton
                  variant="danger"
                  disabled={controlsDisabled}
                  loading={busy === "deleteGroup"}
                  loadingLabel="削除中..."
                  aria-describedby={
                    isOffline ? "group-offline-reason" : undefined
                  }
                  title={isOffline ? disabledReason : undefined}
                  onClick={() => void handleDeleteGroup()}
                >
                  グループを完全に削除
                </ActionButton>
                <p className="mt-2 text-xs leading-relaxed text-gray-500">
                  匿名利用のため、ブラウザデータを消すと作成者権限は復旧できません。
                </p>
              </section>
            </>
          )}
      </div>
    </details>
  );
}
