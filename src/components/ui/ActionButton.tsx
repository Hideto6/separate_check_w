import React from "react";

interface ActionButtonProps {
  onClick: () => void;
  children: React.ReactNode;
  className?: string;
  disabled?: boolean;
}

const ActionButton: React.FC<ActionButtonProps> = ({
  onClick,
  children,
  className = "",
  disabled = false,
}) => {
  const baseClasses =
    "w-full p-4 text-lg mt-3 border-2 border-blue-400 bg-blue-500 text-white font-bold transition-colors hover:bg-blue-400 active:bg-blue-400 disabled:cursor-not-allowed disabled:opacity-60 shadow-md rounded-2xl";
  const combinedClasses = `${baseClasses} ${className}`;

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={combinedClasses}
    >
      {children}
    </button>
  );
};

export default ActionButton;
