import React from "react";

interface ActionButtonProps {
  onClick: () => void;
  children: React.ReactNode;
  className?: string;
}

const ActionButton: React.FC<ActionButtonProps> = ({
  onClick,
  children,
  className = "",
}) => {
  const baseClasses =
    "w-full p-4 text-lg mt-3 border-2 border-blue-400 bg-blue-500 text-white font-bold transition-colors hover:bg-blue-400 active:bg-blue-400 shadow-md rounded-2xl";
  const combinedClasses = `${baseClasses} ${className}`;

  return (
    <button onClick={onClick} className={combinedClasses}>
      {children}
    </button>
  );
};

export default ActionButton;
