
import { 
    GeminiModel, 
    OptimizedContext, 
    RoutingDecision, 
    ActionType,
    RoutingMeta
} from '../../types/index';

/**
 * [PR #9] Core Router: Strategic Control Center
 * Complexity Score 기반 모델 라우팅 엔진.
 */

const ENABLE_ROUTING = true; // Feature Flag
export const PRO_LIMIT = 5; // 세션당 Pro 호출 상한 (Escalation에서도 공유)
const SCORE_THRESHOLD = 5;

export const REASONS = {
    DENSITY: "HIGH_DATA_DENSITY",
    ACTION: "COMPLEX_SYSTEM_ACTION",
    LENGTH: "LONG_INPUT_TEXT",
    CAUSALITY: "CAUSALITY_REWRITE",
    SOCIAL: "MULTI_PERSON_INTERACTION",
    LIMIT: "PRO_LIMIT_EXCEEDED",
    FORCED: "USER_FORCED_REFERENCE",
    QUALITY_ESCALATION: "QUALITY_ESCALATION"
};

/**
 * Pro 사용 가능 여부를 판별합니다.
 */
export const canUsePro = (proUsageCount: number): boolean => {
    return proUsageCount < PRO_LIMIT;
};

/**
 * 복잡도 점수를 계산하고 최적의 모델을 결정합니다.
 */
export const determineRouting = (
    input: string,
    context: OptimizedContext,
    action: ActionType,
    proUsageCount: number,
    hasForcedReference: boolean = false
): RoutingDecision => {
    
    // 롤백 모드 또는 라우팅 비활성화 시 기본값 반환
    if (!ENABLE_ROUTING) {
        return createFallbackDecision('flash', proUsageCount, input, context, action);
    }

    let score = 0;
    const reasons: string[] = [];

    // 1. 데이터 밀도 (Recall 합산 5건 이상)
    const recallCount = (context.relevantChronicles?.length || 0) + (context.relevantMemories?.length || 0);
    if (recallCount >= 5) {
        score += 5;
        reasons.push(REASONS.DENSITY);
    }

    // 2. 복합 액션 (시스템 무결성이 중요한 작업)
    if (action === 'CHRONICLE_WRITE' || action === 'CHAR_ANALYZE') {
        score += 5;
        reasons.push(REASONS.ACTION);
    }

    // 3. 입력 길이 (300자 초과)
    if (input.length > 300) {
        score += 3;
        reasons.push(REASONS.LENGTH);
    }

    // 4. 인과율 충돌 키워드
    if (input.includes("천각의 박동") || input.includes("시간 되감기")) {
        score += 4;
        reasons.push(REASONS.CAUSALITY);
    }

    // 5. 입력 내 이름 언급 기반 간이 측정
    const nameMentions = (input.match(/[가-힣]{2,4}/g) || []).length;
    if (nameMentions >= 3) {
        score += 2;
        reasons.push(REASONS.SOCIAL);
    }

    // 6. 유저 강제 참조 (명시적 고정)
    if (hasForcedReference) {
        score = Math.max(score, SCORE_THRESHOLD);
        reasons.push(REASONS.FORCED);
    }

    // 모델 결정 로직
    let selectedModel: GeminiModel = score >= SCORE_THRESHOLD ? 'pro' : 'flash';

    // Pro 상한 가드레일 적용
    if (selectedModel === 'pro' && !canUsePro(proUsageCount)) {
        console.warn(`[ROUTER] Pro limit reached (${proUsageCount}/${PRO_LIMIT}). Downgrading to Flash.`);
        selectedModel = 'flash';
        reasons.push(REASONS.LIMIT);
    }

    const meta: RoutingMeta = {
        selectedModel,
        isEscalated: false,
        totalScore: score,
        reasons,
        metrics: {
            inputChars: input.length,
            recallCount,
            recallTokens: context.tokenUsage.chronicle + context.tokenUsage.memory,
            actionType: action
        },
        sessionUsage: {
            proCount: proUsageCount,
            limit: PRO_LIMIT
        }
    };

    return { selectedModel, meta };
};

const createFallbackDecision = (
    model: GeminiModel, 
    proUsage: number, 
    input: string, 
    context: OptimizedContext, 
    action: ActionType
): RoutingDecision => ({
    selectedModel: model,
    meta: {
        selectedModel: model,
        isEscalated: false,
        totalScore: 0,
        reasons: ["ROUTING_DISABLED"],
        metrics: {
            inputChars: input.length,
            recallCount: (context.relevantChronicles?.length || 0) + (context.relevantMemories?.length || 0),
            recallTokens: 0,
            actionType: action
        },
        sessionUsage: { proCount: proUsage, limit: PRO_LIMIT }
    }
});
