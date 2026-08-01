import type { ReactNode } from "react";

type PageWidth = "md" | "lg";

const widthClasses: Record<PageWidth, string> = {
  md: "max-w-md",
  lg: "max-w-xl",
};

export default function PageShell({
  children,
  className = "",
  contentClassName = "",
  centered = false,
  width = "md",
}: {
  children: ReactNode;
  className?: string;
  contentClassName?: string;
  centered?: boolean;
  width?: PageWidth;
}) {
  return (
    <main
      className={`min-h-[100dvh] bg-gradient-to-b from-blue-100 to-blue-400 px-4 sm:px-6 ${className}`}
    >
      <div
        className={`mx-auto flex min-h-[100dvh] w-full flex-col pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[max(1.25rem,env(safe-area-inset-top))] ${widthClasses[width]} ${
          centered ? "justify-center" : ""
        } ${contentClassName}`}
      >
        {children}
      </div>
    </main>
  );
}
