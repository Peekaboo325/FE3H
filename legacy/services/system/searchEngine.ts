
/**
 * [Fodlan Search Engine v1.0]
 * 띄어쓰기를 무시하는 정밀 매칭 및 시각적 강조를 위한 정규표현식 엔진입니다.
 */

/**
 * 특수 문자를 정규식에서 안전하게 사용할 수 있도록 이스케이프 처리합니다.
 */
export const escapeRegExp = (string: string) => string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * 띄어쓰기를 무시하고 모든 문자를 순서대로 찾는 정규표현식을 생성합니다.
 * 예: "에델" -> /(에\s*델)/gi
 */
export const getSmartSearchRegex = (query: string) => {
    if (!query.trim()) return null;
    const cleanQuery = query.replace(/\s+/g, '');
    const pattern = cleanQuery.split('').map(char => escapeRegExp(char)).join('\\s*');
    return new RegExp(`(${pattern})`, 'gi');
};

/**
 * 원본 텍스트가 검색어와 (띄어쓰기 무관하게) 일치하는지 확인합니다.
 */
export const matchesSmartly = (text: string | undefined, query: string) => {
    if (!text) return false;
    if (!query.trim()) return true;
    const cleanText = text.replace(/\s+/g, '').toLowerCase();
    const cleanQuery = query.replace(/\s+/g, '').toLowerCase();
    return cleanText.includes(cleanQuery);
};

/**
 * 마크다운 텍스트 내에서 검색어와 일치하는 부분을 HTML span 태그로 감싸서 반환합니다.
 */
export const getHighlightedMarkdown = (text: string, highlight: string) => {
    const regex = getSmartSearchRegex(highlight);
    if (!regex) return text;
    return text.replace(regex, '<span class="bg-blue-200 dark:bg-blue-800 text-gray-900 dark:text-gray-100 rounded-sm">$1</span>');
};
