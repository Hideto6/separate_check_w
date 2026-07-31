"use client";

import { useEffect, useId, useState } from "react";
import ActionButton from "@/components/ui/ActionButton";
import { useGroup } from "@/contexts/GroupContext";

type NoticeTone = "success" | "warning" | "error";

export default function GroupQuickActions({
  isOwner,
  inviteEnabled,
  actionSequence,
  disabled,
  disabledReason,
  onAddPayment,
  onActionStart,
  onNotice,
}: {
  isOwner: boolean;
  inviteEnabled: boolean;
  actionSequence: number;
  disabled: boolean;
  disabledReason?: string;
  onAddPayment: () => void;
  onActionStart: () => void;
  onNotice: (message: string, tone: NoticeTone) => void;
}) {
  const { getInviteLink } = useGroup();
  const fallbackInputId = useId();
  const [isSharing, setIsSharing] = useState(false);
  const [fallbackInviteLink, setFallbackInviteLink] = useState("");

  useEffect(() => {
    setFallbackInviteLink("");
  }, [actionSequence, inviteEnabled]);

  const handleShareInvite = async () => {
    onActionStart();
    setFallbackInviteLink("");
    setIsSharing(true);
    try {
      const result = await getInviteLink();
      if (!result.ok) {
        onNotice(result.message, "error");
        return;
      }

      try {
        if (!navigator.clipboard) {
          throw new Error("Clipboard API is unavailable");
        }
        await navigator.clipboard.writeText(result.data);
        onNotice("招待リンクをコピーしました。", "success");
      } catch {
        setFallbackInviteLink(result.data);
        onNotice(
          "自動でコピーできなかったため、下の招待リンクを長押ししてコピーしてください。",
          "warning"
        );
      }
    } catch {
      onNotice(
        "招待リンクを取得できませんでした。通信状態を確認して、もう一度お試しください。",
        "error"
      );
    } finally {
      setIsSharing(false);
    }
  };

  const shareDisabledReason =
    disabledReason ??
    (!inviteEnabled
      ? "招待を停止中です。グループ設定から再開できます。"
      : undefined);

  return (
    <div className="w-full space-y-2">
      <div className={`grid gap-3 ${isOwner ? "grid-cols-2" : "grid-cols-1"}`}>
        <ActionButton
          onClick={() => {
            onActionStart();
            onAddPayment();
          }}
          disabled={disabled || isSharing}
          title={disabledReason}
        >
          支払いを記録
        </ActionButton>

        {isOwner && (
          <ActionButton
            variant="secondary"
            onClick={() => void handleShareInvite()}
            disabled={disabled || !inviteEnabled}
            loading={isSharing}
            loadingLabel="確認中..."
            title={shareDisabledReason}
          >
            招待リンクを共有
          </ActionButton>
        )}
      </div>

      {isOwner && !inviteEnabled && (
        <p className="text-center text-xs font-bold text-amber-900">
          招待を停止中です。再開はグループ設定から行えます。
        </p>
      )}

      {fallbackInviteLink && (
        <div className="rounded-xl border border-amber-200 bg-amber-50/90 p-3">
          <label
            htmlFor={fallbackInputId}
            className="mb-1 block text-xs font-bold text-amber-900"
          >
            招待リンク
          </label>
          <input
            id={fallbackInputId}
            readOnly
            value={fallbackInviteLink}
            onClick={(event) => event.currentTarget.select()}
            onFocus={(event) => event.currentTarget.select()}
            className="min-h-11 w-full rounded-lg border-2 border-amber-200 bg-white px-3 py-2 text-sm text-gray-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-700"
          />
        </div>
      )}
    </div>
  );
}
