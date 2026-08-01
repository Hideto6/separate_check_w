"use client";

import ActionButton from "@/components/ui/ActionButton";

export default function CachedGroupFallbackButton({
  loading = false,
  onClick,
}: {
  loading?: boolean;
  onClick: () => void;
}) {
  return (
    <ActionButton
      type="button"
      variant="secondary"
      loading={loading}
      loadingLabel="端末データを確認しています..."
      onClick={onClick}
    >
      端末データで続ける
    </ActionButton>
  );
}
