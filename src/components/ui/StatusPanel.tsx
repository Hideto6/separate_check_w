import type { ReactNode } from "react";

type StatusTone = "info" | "warning" | "error" | "success";

const toneClasses: Record<StatusTone, string> = {
  info: "border-blue-200 bg-white/70 text-blue-900",
  warning: "border-amber-200 bg-amber-50/90 text-amber-900",
  error: "border-red-200 bg-red-50/90 text-red-800",
  success: "border-emerald-200 bg-emerald-50/90 text-emerald-900",
};

export default function StatusPanel({
  title,
  message,
  actions,
  className = "",
  loading = false,
  tone = "info",
}: {
  title?: string;
  message: string;
  actions?: ReactNode;
  className?: string;
  loading?: boolean;
  tone?: StatusTone;
}) {
  const isError = tone === "error";
  return (
    <section
      className={`w-full rounded-2xl border-2 p-5 text-center shadow-md backdrop-blur-sm ${toneClasses[tone]} ${className}`}
    >
      {loading && (
        <span
          aria-hidden="true"
          className="mx-auto mb-3 block h-7 w-7 animate-spin rounded-full border-3 border-current border-r-transparent motion-reduce:animate-none"
        />
      )}
      <div
        role={isError ? "alert" : "status"}
        aria-live={isError ? "assertive" : "polite"}
      >
        {title && <h1 className="mb-2 text-xl font-extrabold">{title}</h1>}
        <p className="text-sm font-semibold leading-relaxed">{message}</p>
      </div>
      {actions && <div className="mt-5 flex flex-col gap-2">{actions}</div>}
    </section>
  );
}
