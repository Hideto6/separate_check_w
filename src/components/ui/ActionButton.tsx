import type { ButtonHTMLAttributes, ReactNode } from "react";

type ActionButtonVariant = "primary" | "secondary" | "danger";

interface ActionButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  variant?: ActionButtonVariant;
  loading?: boolean;
  loadingLabel?: string;
}

const variantClasses: Record<ActionButtonVariant, string> = {
  primary:
    "border-blue-400 bg-blue-500 text-white hover:bg-blue-400 active:bg-blue-400",
  secondary:
    "border-blue-300 bg-white/85 text-blue-800 hover:bg-blue-50 active:bg-blue-100",
  danger:
    "border-red-200 bg-red-100 text-red-700 hover:bg-red-200 active:bg-red-200",
};

export default function ActionButton({
  children,
  className = "",
  disabled = false,
  loading = false,
  loadingLabel = "処理しています...",
  type = "button",
  variant = "primary",
  ...buttonProps
}: ActionButtonProps) {
  return (
    <button
      {...buttonProps}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={`flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl border-2 px-4 py-3 text-base font-bold shadow-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-700 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 ${variantClasses[variant]} ${className}`}
    >
      {loading && (
        <span
          aria-hidden="true"
          className="h-5 w-5 shrink-0 animate-spin rounded-full border-2 border-current border-r-transparent motion-reduce:animate-none"
        />
      )}
      <span>{loading ? loadingLabel : children}</span>
    </button>
  );
}
