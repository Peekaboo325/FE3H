import React from 'react';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  variant?: 'default' | 'flat' | 'outline' | 'glass';
  padding?: 'none' | 'sm' | 'md' | 'lg';
  id?: string;
}

export const Card: React.FC<CardProps> = ({
  children,
  className = '',
  variant = 'default',
  padding = 'md',
  id
}) => {
  const baseStyles = "transition-all duration-200";
  
  const variants = {
    default: "bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 shadow-sm",
    flat: "bg-gray-50 dark:bg-gray-800/50 border border-transparent",
    outline: "bg-transparent border border-gray-200 dark:border-gray-700",
    glass: "bg-white/80 dark:bg-gray-900/80 backdrop-blur-md border border-white/20 dark:border-gray-700/30 shadow-lg"
  };

  const paddings = {
    none: "p-0",
    sm: "p-3 md:p-4",
    md: "p-6 md:p-8",
    lg: "p-8 md:p-12"
  };

  return (
    <div 
      id={id}
      className={`${baseStyles} ${variants[variant]} ${paddings[padding]} ${className}`}
    >
      {children}
    </div>
  );
};
