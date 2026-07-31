import type { ReactNode } from "react";

type NoticeTone = "info" | "success" | "warning" | "error";

const toneClasses: Record<NoticeTone, string> = {
  info: "border-blue-200 bg-blue-50/90 text-blue-800",
  success: "border-emerald-200 bg-emerald-50/90 text-emerald-800",
  warning: "border-amber-200 bg-amber-50/95 text-amber-900",
  error: "border-red-200 bg-red-50/95 text-red-700",
};

export default function InlineNotice({
  children,
  className = "",
  tone = "info",
}: {
  children: ReactNode;
  className?: string;
  tone?: NoticeTone;
}) {
  const isError = tone === "error";
  return (
    <div
      role={isError ? "alert" : "status"}
      aria-live={isError ? "assertive" : "polite"}
      className={`w-full rounded-xl border px-4 py-3 text-sm font-bold ${toneClasses[tone]} ${className}`}
    >
      {children}
    </div>
  );
}
