
import { CharacterProfile } from '../../types/index';
import { parseFodlanDate, dateToInteger } from '../../utils/dateUtils';

/**
 * [PR #10] Quality Guard: The Scribe's Intuition
 */

export class GeminiError extends Error {
    constructor(public code: string, message: string, public details?: any) {
        super(message);
        this.name = 'GeminiError';
    }
}

export interface ValidationResult {
    isValid: boolean;
    reason?: string;
}

export const RULES = {
    FORMAT_BREACH: "FORMAT_BREACH", // 헤더 누락
    SUBTAG_MISSING: "SUBTAG_MISSING", // <sub> 태그 누락
    SILENT_VOID: "SILENT_VOID",     // 분량 부족
    REPETITION_LOOP: "REPETITION_LOOP", // 무한 루프
    IDENTITY_ERASURE: "IDENTITY_ERASURE", // 고유명사 오염
    JSON_PARSE_ERROR: "JSON_PARSE_ERROR", // JSON 파싱 실패
    SCHEMA_MISMATCH: "SCHEMA_MISMATCH",   // 스키마 불일치
    DATE_REGRESSION: "DATE_REGRESSION",    // 날짜 역주행
    INVALID_YEAR_INCREMENT: "INVALID_YEAR_INCREMENT", // 연도 상승 오류
    MULTIPLE_MANUSCRIPTS: "MULTIPLE_MANUSCRIPTS" // 다중 원고 출력 오류
};

/**
 * 서사의 품질을 다각도로 검증합니다.
 */
export const validateNarrativeQuality = (
    content: string, 
    expectedEpisode?: number,
    activeCharacters?: CharacterProfile[],
    lastFodlanDate?: string
): ValidationResult => {

    // 1. Format Breach: ### [숫자]화 헤더 체크
    const headers = content.match(/###\s*\d+화/g);
    if (headers && headers.length > 1) {
        return { isValid: false, reason: RULES.MULTIPLE_MANUSCRIPTS };
    }

    if (expectedEpisode !== undefined) {
        const headerPattern = new RegExp(`###\\s*${expectedEpisode}화`);
        if (!headerPattern.test(content)) {
            return { isValid: false, reason: RULES.FORMAT_BREACH };
        }
    } else if (!/###\s*\d+화/.test(content)) {
        return { isValid: false, reason: RULES.FORMAT_BREACH };
    }

    // 2. Subtag Check: <sub> 태그 존재 여부
    if (!/<sub>.*?<\/sub>/i.test(content)) {
        return { isValid: false, reason: RULES.SUBTAG_MISSING };
    }

    // 3. Silent Void: 최소 분량 체크
    if (content.length < 50) {
        return { isValid: false, reason: RULES.SILENT_VOID };
    }

    // 4. Repetition Loop: 동일 문장 반복 체크
    const sentences = content.split(/[.!?\n]/).filter(s => s.trim().length > 10);
    const uniqueSentences = new Set(sentences);
    if (sentences.length > 5 && uniqueSentences.size < sentences.length * 0.6) {
        return { isValid: false, reason: RULES.REPETITION_LOOP };
    }

    // 5. Date Regression & Integrity Check
    if (lastFodlanDate) {
        const dateMatch = content.match(/<sub>제국력\s*(\d+년\s*[가-힣]+의\s*달\s*\d+일)/);
        if (dateMatch) {
            const currentParsed = parseFodlanDate(dateMatch[1]);
            const lastParsed = parseFodlanDate(lastFodlanDate);
            
            if (currentParsed && lastParsed) {
                const currentInt = dateToInteger(currentParsed);
                const lastInt = dateToInteger(lastParsed);

                // 5-A. 단순 역주행 체크
                if (currentInt < lastInt) {
                    return { isValid: false, reason: RULES.DATE_REGRESSION };
                }

                // 5-B. 연도 상승 정합성 체크 (고월의 달(3월) 이후에만 연도 상승 가능)
                // last가 4~12월이거나 1~3월인데 current가 연도가 올랐다면, 
                // last가 반드시 3월(고월)이었어야 함.
                if (currentParsed.year > lastParsed.year) {
                    if (lastParsed.month !== 3 || currentParsed.month !== 4) {
                        return { isValid: false, reason: "INVALID_YEAR_INCREMENT" };
                    }
                }
                
                // 5-C. 같은 연도 내에서 1~3월인데 연도가 올랐을 경우 차단
                if (currentParsed.year !== lastParsed.year && lastParsed.month >= 4 && currentParsed.month <= 3) {
                     // 1180년 12월 -> 1181년 1월 같은 경우 (연도는 1180으로 유지되어야 함)
                     return { isValid: false, reason: "INVALID_YEAR_INCREMENT" };
                }
            }
        }
    }

    return { isValid: true };
};

/**
 * AI가 반환한 JSON 데이터의 유효성을 검증합니다.
 */
export const validateJsonResponse = <T>(
    text: string, 
    requiredFields: (keyof T)[]
): T => {
    let jsonStr = text;
    try {
        // Markdown 코드 블록 및 주변 텍스트 제거 (가장 바깥쪽 { } 추출)
        const firstOpen = text.indexOf('{');
        const lastClose = text.lastIndexOf('}');
        
        if (firstOpen !== -1 && lastClose !== -1 && lastClose > firstOpen) {
            jsonStr = text.substring(firstOpen, lastClose + 1);
        } else {
            jsonStr = text.replace(/```json\n?|\n?```/g, '').trim();
        }

        const data = JSON.parse(jsonStr) as T;
        
        for (const field of requiredFields) {
            if (data[field] === undefined || data[field] === null) {
                // [Stable-Sync] 빈 배열 허용 및 자동 보정 (memories 필드 특화)
                if (field === 'memories' as keyof T) {
                    (data as any).memories = [];
                    continue;
                }
                throw new GeminiError(RULES.SCHEMA_MISMATCH, `필수 필드 누락: ${String(field)}`);
            }
        }
        
        return data;
    } catch (e) {
        if (e instanceof GeminiError) throw e;
        console.error("[JSON_PARSE_DEBUG] Failed text:", text);
        throw new GeminiError(RULES.JSON_PARSE_ERROR, "AI 응답을 JSON으로 해석할 수 없습니다.", { raw: text });
    }
};
