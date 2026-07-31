"use client";

import { IoCloseSharp } from "react-icons/io5";
import type { MemberListProps } from "@/types";

interface MemberListFieldProps extends MemberListProps {
  disabled?: boolean;
}

const MemberList = ({
  disabled = false,
  members,
  onDeleteMember,
}: MemberListFieldProps) => {
  if (members.length === 0) {
    return (
      <p className="mt-3 text-sm font-medium text-gray-500">
        まだメンバーは追加されていません。
      </p>
    );
  }

  return (
    <ul
      aria-label="追加したメンバー"
      className="mt-3 flex w-full flex-row flex-wrap gap-2"
    >
      {members.map((name) => (
        <li
          key={name}
          className="flex min-h-11 max-w-full items-center rounded-2xl border border-blue-300 bg-blue-50 pl-3 font-bold text-gray-700 shadow-sm transition-shadow hover:shadow-md"
        >
          <span className="min-w-0 break-words py-2">{name}</span>
          <button
            type="button"
            aria-label={`${name}を削除`}
            onClick={() => onDeleteMember(name)}
            disabled={disabled}
            className="ml-1 flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-full text-red-500 transition-colors hover:bg-red-500 hover:text-white active:bg-red-600 active:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-700 focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <IoCloseSharp aria-hidden="true" size={20} />
          </button>
        </li>
      ))}
    </ul>
  );
};

export default MemberList;
