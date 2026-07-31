import type {
  ChangeEventHandler,
  InputHTMLAttributes,
} from "react";
import { forwardRef } from "react";

interface TextInputProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "onChange" | "value"> {
  value: string;
  onChange: ChangeEventHandler<HTMLInputElement>;
}

const TextInput = forwardRef<HTMLInputElement, TextInputProps>(
  function TextInput({ className = "", type = "text", ...inputProps }, ref) {
    return (
      <input
        {...inputProps}
        ref={ref}
        type={type}
        className={`min-h-12 w-full rounded-lg border-2 border-gray-200 bg-white px-3 py-2.5 text-base text-gray-800 shadow-sm transition-colors placeholder:text-gray-400 focus-visible:border-blue-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300 disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-500 aria-invalid:border-red-400 aria-invalid:ring-red-200 ${className}`}
      />
    );
  }
);

export default TextInput;
