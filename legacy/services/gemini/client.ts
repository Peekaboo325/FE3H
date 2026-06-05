
import { GoogleGenAI, HarmCategory, HarmBlockThreshold } from "@google/genai";

/**
 * [Phase 4-3: Optimized Facade] 
 * 저수준 통신 레이어 및 공통 상수 관리소.
 */

// API Initialization
export const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || import.meta.env.VITE_API_KEY });

// Safety Settings
export const SAFETY_SETTINGS = [
    { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
    { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
    { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
    { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
];

/**
 * [Phase 4-3] 한국어 출력 강제 메시지
 */
export const KOREAN_ENFORCEMENT_MSG = "\n\n[SYSTEM WARNING] The previous response was incorrectly in English. You MUST translate the ENTIRE output into natural Korean (한국어).";

/**
 * API 응답에서 JSON 문자열을 추출하고 파싱합니다.
 */
export const cleanAndParseJSON = (text: string) => {
    if (!text) return {};
    let cleaned = text.replace(/```json/g, '').replace(/```/g, '').trim();
    try {
        // Try to find the first and last structural characters ({ or [)
        const firstOpenBrace = cleaned.indexOf('{');
        const firstOpenBracket = cleaned.indexOf('[');
        const lastCloseBrace = cleaned.lastIndexOf('}');
        const lastCloseBracket = cleaned.lastIndexOf(']');

        let firstOpen = -1;
        let lastClose = -1;

        // Determine if we should look for an object or an array based on what appears first
        if (firstOpenBrace !== -1 && (firstOpenBracket === -1 || firstOpenBrace < firstOpenBracket)) {
            firstOpen = firstOpenBrace;
            lastClose = lastCloseBrace;
        } else if (firstOpenBracket !== -1) {
            firstOpen = firstOpenBracket;
            lastClose = lastCloseBracket;
        }

        if (firstOpen !== -1 && lastClose !== -1 && lastClose > firstOpen) {
            const jsonCandidate = cleaned.substring(firstOpen, lastClose + 1);
            return JSON.parse(jsonCandidate);
        }
        return JSON.parse(cleaned);
    } catch (e) {
        console.warn("[Phase 4-1] JSON Parsing Failed, returning empty object", e);
        return {};
    }
};

/**
 * 텍스트에 한국어가 포함되어 있는지 확인합니다.
 */
export const isKoreanText = (text: string) => {
    if (!text) return false;
    const koreanRegex = /[가-힣]/;
    return koreanRegex.test(text);
};

/**
 * [Phase 4-3] API 호출 시마다 인스턴스를 동적으로 생성하여 
 * 최신 API 키 반영 및 세션 꼬임 방지
 */
const getAIInstance = () => new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || import.meta.env.VITE_API_KEY });

/**
 * [Phase 4-1] 천각의 박동(Retry) 엔진 + 타임아웃
 */
export const callGeminiWithRetry = async (
    params: any,
    onRetry?: (msg: string) => void,
    maxRetries = 2
): Promise<any> => {
    let lastError: any;
    const RETRY_MSG = "시간의 흐름이 가파릅니다. 잠시 박동을 늦추십시오.";
    const QUOTA_MSG = "서신이 너무 많이 몰려 전령이 지쳤습니다. 잠시 후 다시 시도해 주세요.";
    const TIMEOUT_MSG = "전령이 길을 잃었습니다. 다시 한 번 불러주세요.";
    const UNAVAILABLE_MSG = "모델이 현재 매우 바쁩니다. 잠시 후 자동으로 다시 시도합니다.";

    for (let i = 0; i < maxRetries; i++) {
        try {
            const ai = getAIInstance();
            
            // 120초 타임아웃 설정 (복잡한 추론 및 대량 데이터 처리 대비)
            const timeoutPromise = new Promise((_, reject) => 
                setTimeout(() => reject(new Error("TIMEOUT")), 120000)
            );
            
            const requestPromise = ai.models.generateContent(params);
            
            return await Promise.race([requestPromise, timeoutPromise]);
        } catch (error: any) {
            lastError = error;
            const isTimeout = error?.message === "TIMEOUT";
            const status = error?.status || 0;
            const isQuotaError = status === 429;
            const isUnavailable = status === 503;
            const isRetryable = isQuotaError || isTimeout || isUnavailable || (status >= 500 && status <= 599);
            
            if (isRetryable && i < maxRetries - 1) {
                let msg = RETRY_MSG;
                if (isTimeout) msg = TIMEOUT_MSG;
                else if (isQuotaError) msg = QUOTA_MSG;
                else if (isUnavailable) msg = UNAVAILABLE_MSG;

                onRetry?.(msg);
                
                // 타임아웃/503 시에는 조금 더 짧게 대기 후 재시도
                const jitter = Math.random() * 2000;
                const baseDelay = isQuotaError ? 5000 : (isTimeout || isUnavailable ? 1500 : 2000); 
                const delay = Math.pow(3, i) * baseDelay + jitter;
                
                console.warn(`[API_RETRY] Attempt ${i + 1} failed (${isTimeout ? 'TIMEOUT' : status}). Retrying in ${Math.round(delay)}ms...`);
                await new Promise(resolve => setTimeout(resolve, delay));
                continue;
            }
            
            throw error;
        }
    }
    throw lastError;
};
