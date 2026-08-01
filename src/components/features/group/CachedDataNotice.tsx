"use client";

import ActionButton from "@/components/ui/ActionButton";
import InlineNotice from "@/components/ui/InlineNotice";

const formatCachedAt = (cachedAt: string | null) => {
  if (!cachedAt) return "この画面で最後に取得した";
  const date = new Date(cachedAt);
  if (Number.isNaN(date.getTime())) {
    return "この画面で最後に取得した";
  }
  return new Intl.DateTimeFormat("ja-JP", {
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
};

export default function CachedDataNotice({
  cachedAt,
  pendingCount,
  blockedCount,
  authRecoveryRequired,
  retrying,
  onRetry,
}: {
  cachedAt: string | null;
  pendingCount: number;
  blockedCount: number;
  authRecoveryRequired: boolean;
  retrying: boolean;
  onRetry: () => void;
}) {
  return (
    <InlineNotice tone="warning">
      <div className="space-y-3">
        <div>
          <p>
            共有サービスに接続できないため、{formatCachedAt(cachedAt)}
            時点の端末データを表示しています。
          </p>
          <p className="mt-1 text-xs leading-relaxed">
            既存データは閲覧専用です。
            {authRecoveryRequired
              ? pendingCount > 0
                ? ` 匿名認証セッションを確認できないため、未同期の支払い${pendingCount}件は同じセッションが復旧するまで自動登録しません。`
                : " 匿名認証セッションを確認できるまで、新しい支払いは端末だけに保存します。"
              : blockedCount > 0
              ? ` 未同期の支払い${pendingCount}件のうち、確認が必要な支払いが${blockedCount}件あります。自動登録は停止しているため、グループ画面で内容を確認してください。`
              : pendingCount > 0
                ? ` 未同期の支払いが${pendingCount}件あります。復旧後に自動登録します。`
              : " 新しい支払いは端末に保存できます。"}
          </p>
          {authRecoveryRequired && blockedCount > 0 && (
            <p className="mt-1 text-xs font-bold leading-relaxed text-red-800">
              確認が必要な支払いが{blockedCount}
              件あります。グループ画面で内容を確認してください。
            </p>
          )}
        </div>
        <ActionButton
          type="button"
          variant="secondary"
          loading={retrying}
          loadingLabel="接続を確認しています..."
          onClick={onRetry}
          className="min-h-11 py-2 text-sm"
        >
          接続を再試行
        </ActionButton>
      </div>
    </InlineNotice>
  );
}
