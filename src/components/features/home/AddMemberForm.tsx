"use client";

import { useState } from "react";
import { IoAddOutline } from "react-icons/io5";
import TextInput from "@/components/ui/TextInput";

interface AddMemberFormProps {
  onAddMember: (memberName: string) => void;
}

const AddMemberForm: React.FC<AddMemberFormProps> = ({ onAddMember }) => {
  const [memberName, setMemberName] = useState("");

  const handleAdd = () => {
    const trimmedMemberName = memberName.trim();
    if (trimmedMemberName) {
      onAddMember(trimmedMemberName);
      setMemberName("");
    }
  };

  return (
    <div className="w-80">
      <label
        htmlFor="memberName"
        className="block text-sm font-extrabold text-gray-700 mb-1"
      >
        メンバー名：
      </label>
      <div className="flex items-center mb-3">
        <TextInput
          id="memberName"
          placeholder="例：太郎"
          value={memberName}
          onChange={(e) => setMemberName(e.target.value)}
          className="mr-2"
        />
        <button
          onClick={handleAdd}
          className="bg-blue-500 p-3 border-2 border-blue-400 rounded-lg text-white font-bold hover:bg-blue-400 active:bg-blue-400 transition-colors shadow"
        >
          <IoAddOutline size={25} />
        </button>
      </div>
    </div>
  );
};

export default AddMemberForm;
