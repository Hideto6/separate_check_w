"use client";
import React from "react";

interface TextInputProps {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string;
  className?: string;
  type?: string;
  id?: string;
  name?: string;
}

const TextInput: React.FC<TextInputProps> = ({
  value,
  onChange,
  placeholder = "",
  className = "",
  type = "text",
  id,
  name,
}) => {
  const baseClasses =
    "w-full p-3 border-2 bg-white border-gray-200 rounded-lg focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-300 transition-colors";
  const combinedClasses = `${baseClasses} ${className}`;

  return (
    <input
      id={id}
      name={name}
      type={type}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      className={combinedClasses}
    />
  );
};

export default TextInput;
