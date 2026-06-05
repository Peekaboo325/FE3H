
/**
 * [PR #8] Token Estimation Utility
 * 한글 1자 ≒ 0.8 토큰, 영문/기호 1자 ≒ 0.4 토큰 가중치를 적용하여 근사치를 계산합니다.
 */

export const estimateTokens = (text: string | undefined | null): number => {
    if (!text) return 0;
    
    // 한글 글자수 추출
    const koreanChars = text.match(/[가-힣]/g)?.length || 0;
    // 나머지 글자수 (공백, 기호, 영문 등)
    const otherChars = text.length - koreanChars;
    
    // 근사 토큰 계산 (Gemini 가중치 기준 추정)
    return Math.ceil(koreanChars * 0.8 + otherChars * 0.4);
};

/**
 * 객체의 특정 필드들에 대한 총 토큰 합계를 계산합니다.
 */
export const estimateObjectTokens = (obj: any, fields: string[]): number => {
    if (!obj) return 0;
    return fields.reduce((sum, field) => sum + estimateTokens(obj[field]), 0);
};
