"use client";

import { useState } from "react";
import { IoAddOutline } from "react-icons/io5";
import TextInput from "@/components/ui/TextInput";

interface AddMemberFormProps {
  disabled?: boolean;
  error?: string | null;
  onAddMember: (memberName: string) => boolean | void;
  onInputChange?: () => void;
  onValidationError?: (message: string) => void;
}

const AddMemberForm = ({
  disabled = false,
  error,
  onAddMember,
  onInputChange,
  onValidationError,
}: AddMemberFormProps) => {
  const [memberName, setMemberName] = useState("");

  const handleAdd = () => {
    const trimmedMemberName = memberName.trim();
    if (!trimmedMemberName) {
      onValidationError?.("メンバー名を入力してください。");
      return;
    }

    const wasAdded = onAddMember(trimmedMemberName);
    if (wasAdded !== false) {
      setMemberName("");
    }
  };

  return (
    <fieldset disabled={disabled} className="min-w-0 w-full">
      <legend className="text-sm font-extrabold text-gray-700">
        メンバー
      </legend>
      <p id="memberNameHelp" className="mt-1 text-xs font-medium text-gray-500">
        一緒に割り勘する人を2人以上追加してください。
      </p>
      <div className="mt-2 flex items-stretch gap-2">
        <label htmlFor="memberName" className="sr-only">
          追加するメンバー名
        </label>
        <TextInput
          id="memberName"
          placeholder="例：太郎"
          value={memberName}
          onChange={(event) => {
            setMemberName(event.target.value);
            onInputChange?.();
          }}
          onKeyDown={(event) => {
            if (
              event.key === "Enter" &&
              !event.nativeEvent.isComposing
            ) {
              event.preventDefault();
              handleAdd();
            }
          }}
          aria-describedby={`memberNameHelp${error ? " memberNameError" : ""}`}
          aria-invalid={Boolean(error)}
          autoComplete="off"
          disabled={disabled}
        />
        <button
          type="button"
          aria-label="メンバーを追加"
          onClick={handleAdd}
          disabled={disabled}
          className="flex min-h-12 min-w-12 shrink-0 items-center justify-center rounded-lg border-2 border-blue-400 bg-blue-500 text-white shadow transition-colors hover:bg-blue-400 active:bg-blue-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-700 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <IoAddOutline aria-hidden="true" size={25} />
        </button>
      </div>
      {error && (
        <p
          id="memberNameError"
          role="alert"
          className="mt-2 text-sm font-bold text-red-600"
        >
          {error}
        </p>
      )}
    </fieldset>
  );
};

export default AddMemberForm;
