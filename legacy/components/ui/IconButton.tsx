
import React from 'react';

interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'danger' | 'primary' | 'ghost'; 
  size?: 'sm' | 'md' | 'lg';
  active?: boolean;
}

export const IconButton: React.FC<IconButtonProps> = ({ 
  variant = 'default', 
  size = 'md', 
  active = false,
  className = '', 
  children, 
  title,
  ...props 
}) => {
  
  // [GHOST BUTTON ARCHITECTURE]
  // 배경색 변경 없이(bg-transparent), 아이콘/텍스트 색상만으로 상호작용을 표현합니다.
  const baseStyle = "flex items-center justify-center transition-colors duration-200 rounded shrink-0 bg-transparent focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2";
  
  const sizeStyles = {
    sm: "p-1",
    md: "p-1.5 md:p-2", // 모바일/데스크탑 터치 영역 최적화
    lg: "p-3",
  };

  // [COLOR LOGIC]
  // Danger -> Red Interaction
  // Others -> Blue Interaction (Unified)
  const isDanger = variant === 'danger';

  // 1. 기본 상태 (Inactive)
  const defaultColor = "text-gray-400";

  // 2. Hover 상태
  const hoverColor = isDanger
    ? "hover:text-red-600 dark:hover:text-red-500"
    : "hover:text-blue-600 dark:hover:text-blue-500";

  // 3. Active 상태 (클릭됨/활성화됨)
  const activeColor = active
    ? (isDanger ? "text-red-600 dark:text-red-500" : "text-blue-600 dark:text-blue-500")
    : "";

  return (
    <button 
      className={`${baseStyle} ${sizeStyles[size]} ${defaultColor} ${hoverColor} ${activeColor} ${className}`}
      type="button"
      title={title}
      aria-label={props['aria-label'] || title}
      {...props}
    >
      {children}
    </button>
  );
};
