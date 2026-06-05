
/**
 * 해시태그 후처리 유틸리티
 * AI가 생성한 태그를 UI에 표시하기 적합한 형태로 정제합니다.
 */

// 허용된 특수문자 외 제거 (한글, 영문, 숫자만 허용)
const VALID_CHARS_REGEX = /[^가-힣a-zA-Z0-9]/g;

/**
 * 단일 해시태그 문자열을 정제합니다.
 * 1. '#' 기호 제거 (UI에서 붙임)
 * 2. 괄호 내용 삭제가 아닌, 괄호 기호만 제거 (프롬프트에서 순서 정렬 유도)
 * 3. 공백 제거 (띄어쓰기 금지)
 * 4. 글자수 제한 (너무 긴 태그 방지)
 */
export const sanitizeHashtag = (tag: string): string => {
    if (!tag) return "";

    // 1. 내용물 정제
    let cleaned = tag;
    
    // 괄호 기호 제거 (내용은 살림, 프롬프트가 '벨레트한정수줍음' 처럼 합성어 순서로 내뱉길 기대)
    cleaned = cleaned.replace(/[\(\)\[\]\{\}]/g, ''); 
    
    // '#' 제거
    cleaned = cleaned.replace(/#/g, '');

    // 공백 제거 (하드코딩 강제)
    cleaned = cleaned.replace(/\s+/g, '');

    // 특수문자(이모지 등) 제거
    cleaned = cleaned.replace(VALID_CHARS_REGEX, '');

    // 2. 길이 제한 (안전장치) - 최대 15자
    if (cleaned.length > 15) {
        cleaned = cleaned.slice(0, 15);
    }

    return cleaned.trim();
};

/**
 * 태그 배열 전체를 정제하고, 빈 값이나 중복을 제거합니다.
 */
export const sanitizeTagArray = (tags: string[] | undefined, maxCount: number = 4): string[] => {
    if (!tags || !Array.isArray(tags)) return [];

    const uniqueTags = new Set<string>();
    
    tags.forEach(t => {
        const clean = sanitizeHashtag(t);
        // 한 글자 태그는 의미가 모호하므로 제외 (최소 2글자)
        if (clean.length >= 2) {
            uniqueTags.add(clean);
        }
    });

    return Array.from(uniqueTags).slice(0, maxCount);
};
