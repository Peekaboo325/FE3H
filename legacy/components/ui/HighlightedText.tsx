
import React, { useMemo } from 'react';
import { getSmartSearchRegex } from '../../services/system/searchEngine';

interface HighlightedTextProps {
    text: string;
    highlight: string;
    className?: string;
}

/**
 * [UI Component: HighlightedText]
 * 텍스트 내부의 검색 키워드를 시각적으로 강조합니다.
 * useMemo를 통해 검색 시 발생하는 렌더링 부하를 최소화합니다.
 */
export const HighlightedText: React.FC<HighlightedTextProps> = React.memo(({ text, highlight, className = "" }) => {
    const regex = useMemo(() => getSmartSearchRegex(highlight), [highlight]);
    
    if (!regex || !text) {
        return <span className={className}>{text}</span>;
    }

    const parts = text.split(regex);
    
    return (
        <span className={className} title={text}>
            {parts.map((part, i) => {
                const isMatch = regex.test(part);
                // Regex instance reuse를 위해 index 초기화
                regex.lastIndex = 0;
                
                return isMatch ? (
                    <span key={i} className="bg-blue-200 dark:bg-blue-800 text-gray-900 dark:text-gray-100 rounded-sm box-decoration-clone">
                        {part}
                    </span>
                ) : (
                    <span key={i}>{part}</span>
                );
            })}
        </span>
    );
});
