
import React, { useState, useRef, useEffect } from 'react';

interface FodlanSearchBarProps {
    value: string;
    onChange: (val: string) => void;
    placeholder?: string;
    className?: string;
}

/**
 * [Fodlan Search Bar Module]
 * 사이드바 하단에 위치하는 원형 확장형 검색 컴포넌트입니다.
 * UI 상태 관리와 애니메이션 로직을 캡슐화합니다.
 */
export const FodlanSearchBar: React.FC<FodlanSearchBarProps> = ({
    value,
    onChange,
    placeholder = "기록 검색...",
    className = ""
}) => {
    const [isExpanded, setIsExpanded] = useState(!!value);
    const inputRef = useRef<HTMLInputElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    // 외부 클릭 시 비어있으면 축소
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (isExpanded && containerRef.current && !containerRef.current.contains(e.target as Node)) {
                if (!value.trim()) setIsExpanded(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isExpanded, value]);

    // 확장 시 포커스 강제
    useEffect(() => {
        if (isExpanded && inputRef.current) {
            inputRef.current.focus();
        }
    }, [isExpanded]);

    const handleClear = (e: React.MouseEvent) => {
        e.stopPropagation();
        onChange("");
        setIsExpanded(false);
    };

    return (
        <div className={`absolute bottom-6 left-6 right-6 z-20 flex justify-end pointer-events-none ${className}`}>
            <div 
                ref={containerRef}
                className={`
                    pointer-events-auto flex items-center overflow-hidden bg-white dark:bg-gray-800 shadow-xl border border-gray-200 dark:border-gray-700 rounded-full transition-all duration-300 ease-out
                    ${isExpanded ? 'w-full px-1' : 'w-10 h-10 justify-center cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 hover:scale-105'}
                `}
                onClick={() => !isExpanded && setIsExpanded(true)}
            >
                {isExpanded ? (
                    <div className="flex items-center w-full h-10 px-2 gap-2">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4 text-gray-400 shrink-0">
                            <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
                        </svg>
                        <input 
                            ref={inputRef}
                            value={value}
                            onChange={(e) => onChange(e.target.value)}
                            className="flex-1 bg-transparent border-none focus:outline-none focus:ring-0 text-xs font-bold text-gray-800 dark:text-gray-200 placeholder-gray-400 h-full min-w-0"
                            placeholder={placeholder}
                        />
                        <button 
                            onClick={handleClear}
                            className="p-1 rounded-full text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors shrink-0"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-3.5 h-3.5">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>
                ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                        <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
                    </svg>
                )}
            </div>
        </div>
    );
};
