"use client";

import { useRouter } from "next/navigation";
import { IoChevronBack } from "react-icons/io5";

export default function BackButton({ className }: { className?: string }) {
  const router = useRouter();

  return (
    <button
      className={`mt-5 mb-2 text-blue-900 hover:bg-blue-100 active:bg-blue-100 rounded-full p-2 transition-colors ${
        className || ""
      }`}
      onClick={() => router.back()}
    >
      <IoChevronBack size={28} />
    </button>
  );
}
