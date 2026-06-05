import React from 'react';
import { Loader2 } from 'lucide-react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg' | 'icon';
  isLoading?: boolean;
}

const Button: React.FC<ButtonProps> = ({
  children,
  className = '',
  variant = 'primary',
  size = 'md',
  isLoading = false,
  disabled,
  ...props
}) => {
  const baseStyles = "inline-flex items-center justify-center font-bold uppercase tracking-widest transition-all duration-200 focus:outline-none focus:ring-1 focus:ring-offset-1 disabled:opacity-30 disabled:pointer-events-none select-none";

  const variants = {
    primary: "bg-gray-900 dark:bg-gray-100 text-white dark:text-black hover:opacity-90 border border-transparent focus:ring-gray-500",
    secondary: "bg-gray-50 dark:bg-gray-800 text-gray-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 border border-transparent focus:ring-blue-500",
    ghost: "bg-transparent text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 focus:ring-gray-200",
    danger: "bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 border border-red-100 dark:border-red-800 hover:bg-red-100 dark:hover:bg-red-900/40 focus:ring-red-500",
  };

  const sizes = {
    sm: "h-8 px-3 text-[10px]",
    md: "h-11 px-5 text-xs",
    lg: "h-14 px-8 text-sm",
    icon: "h-11 w-11 p-0",
  };

  const radius = size === 'icon' ? 'rounded-xl' : 'rounded-none';

  return (
    <button
      className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${radius} ${className}`}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : children}
    </button>
  );
};

export default Button;