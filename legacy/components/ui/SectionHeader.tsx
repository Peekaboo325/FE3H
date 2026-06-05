
import React from 'react';
import { IconButton } from './IconButton';

interface SectionHeaderProps {
  title?: string;
  leftContent?: React.ReactNode;
  rightContent?: React.ReactNode;
  onClose?: () => void;
  className?: string;
  borderColor?: string;
  textColor?: string;
}

export const SectionHeader: React.FC<SectionHeaderProps> = ({
  title,
  leftContent,
  rightContent,
  onClose,
  className = '',
  borderColor = 'border-gray-100 dark:border-gray-800',
  textColor = 'text-gray-500'
}) => {
  return (
    <div className={`h-14 flex items-center justify-between px-4 md:px-6 border-b ${borderColor} bg-white dark:bg-[#121214] shrink-0 z-20 transition-colors ${className}`}>
      {/* 
        [Left Section]
        네거티브 마진(-ml) 적용: IconButton의 기본 패딩(p-1.5/p-2)을 상쇄하여
        아이콘이 시각적으로 헤더의 좌측 가이드라인(px-4/px-6)에 정확히 맞도록 보정함.
      */}
      <div className="flex items-center gap-3 overflow-hidden">
        <div className="flex items-center -ml-1.5 md:-ml-2 empty:hidden shrink-0">
            {leftContent}
        </div>
        {title && (
          <h2 className={`text-[10px] font-bold uppercase tracking-[0.2em] whitespace-nowrap overflow-hidden text-ellipsis font-sans ${textColor}`}>
            {title}
          </h2>
        )}
      </div>

      {/* 
        [Right Section]
        네거티브 마진(-mr) 적용: 우측 버튼들도 동일하게 우측 끝선에 맞춤.
      */}
      <div className="flex items-center gap-1 md:gap-2 shrink-0 -mr-1.5 md:-mr-2">
        {rightContent}
        
        {/* Divider - 버튼 그룹과 닫기 버튼 사이에 구분선이 필요할 경우 */}
        {rightContent && onClose && (
           <div className="w-px h-3 bg-gray-200 dark:bg-gray-700 mx-1 md:mx-2 my-auto" />
        )}

        {onClose && (
          <IconButton onClick={onClose} title="닫기">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </IconButton>
        )}
      </div>
    </div>
  );
};
