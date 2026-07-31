"use client";

import { useRouter } from "next/navigation";
import { IoChevronBack } from "react-icons/io5";

export default function BackButton({
  className,
  onClick,
}: {
  className?: string;
  onClick?: () => void;
}) {
  const router = useRouter();

  return (
    <button
      type="button"
      aria-label="前の画面に戻る"
      className={`flex min-h-11 min-w-11 items-center justify-center rounded-full p-2 text-blue-900 transition-colors hover:bg-blue-100 active:bg-blue-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-700 focus-visible:ring-offset-2 ${
        className || ""
      }`}
      onClick={onClick || (() => router.back())}
    >
      <IoChevronBack size={28} />
    </button>
  );
}
