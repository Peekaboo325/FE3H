import React from 'react';

interface BadgeProps {
  children: React.ReactNode;
  variant?: 'default' | 'primary' | 'secondary' | 'outline' | 'danger' | 'success' | 'ghost';
  className?: string;
  size?: 'xs' | 'sm' | 'md';
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'default',
  className = '',
  size = 'sm'
}) => {
  const baseStyles = "inline-flex items-center justify-center font-bold uppercase tracking-widest rounded-sm transition-all";
  
  const variants = {
    default: "bg-gray-50 dark:bg-gray-800 text-gray-500 dark:text-gray-400 border border-gray-100 dark:border-gray-700",
    primary: "bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 border border-blue-100 dark:border-blue-800",
    secondary: "bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-800",
    outline: "bg-transparent text-gray-400 dark:text-gray-500 border border-gray-200 dark:border-gray-700",
    danger: "bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 border border-red-100 dark:border-red-800",
    success: "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-800",
    ghost: "bg-transparent text-blue-500/70 dark:text-blue-400/70 border-none"
  };

  const sizes = {
    xs: "text-[8px] px-1.5 py-0.5",
    sm: "text-[10px] px-2 py-0.5",
    md: "text-[11px] px-3 py-1"
  };

  return (
    <span className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${className}`}>
      {children}
    </span>
  );
};
