import React, { forwardRef } from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(({
  label,
  error,
  helperText,
  className = '',
  ...props
}, ref) => {
  const labelClass = "text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase block mb-1.5 tracking-wider";
  const inputBaseClass = "w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-sm px-3 h-10 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all outline-none dark:text-gray-200 placeholder-gray-300 dark:placeholder-gray-600 font-sans disabled:opacity-50 disabled:cursor-not-allowed";
  const errorClass = error ? "border-red-500 focus:border-red-500 focus:ring-red-500" : "";

  return (
    <div className="w-full">
      {label && <label className={labelClass}>{label}</label>}
      <input
        ref={ref}
        className={`${inputBaseClass} ${errorClass} ${className}`}
        {...props}
      />
      {error && <p className="mt-1 text-[10px] text-red-500 font-medium">{error}</p>}
      {!error && helperText && <p className="mt-1 text-[10px] text-gray-400">{helperText}</p>}
    </div>
  );
});

Input.displayName = 'Input';
