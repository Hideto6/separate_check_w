"use client";

import { IoCloseSharp } from "react-icons/io5";
import { MemberListProps } from "@/types";

const MemberList: React.FC<MemberListProps> = ({ members, onDeleteMember }) => {
  return (
    <div className="flex flex-row flex-wrap gap-1 mb-6 w-80">
      {members.map((name) => (
        <span
          key={name}
          className="flex items-center border border-blue-300 bg-blue-50 rounded-2xl px-3 py-2 shadow-sm hover:shadow-md transition-shadow font-bold text-gray-600"
        >
          {name}
          <button
            onClick={() => onDeleteMember(name)}
            className=" w-6 h-6 flex items-center ml-2 justify-center text-red-500 font-bold rounded-full hover:bg-red-500 hover:text-white active:bg-red-600 active:text-white transition-colors"
          >
            <IoCloseSharp size={20} />
          </button>
        </span>
      ))}
    </div>
  );
};

export default MemberList;
