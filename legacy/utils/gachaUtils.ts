
/**
 * [가챠/확률 유틸리티]
 * 재력(Wealth) 스탯에 따른 아이템 획득 수량 결정 및 이모지 살균
 * 
 * 알고리즘: "부의 변덕 (Whims of Wealth)"
 * - 재력이 높아도 100% 6개를 보장하지 않음 (가중치 확률).
 * - 재력이 낮아도 0.1%의 기적(Jackpot) 존재.
 */

export const getWealthBasedItemCount = (wealth: number): number => {
    // 0~100 사이의 난수 생성
    const random = Math.random() * 100;

    // Tier 1: 궁핍/절약 (Wealth 0 ~ 39)
    if (wealth < 40) {
        // 1개: 40%
        if (random < 40) return 1;
        // 2개: 40% (누적 80%)
        if (random < 80) return 2;
        // 3개: 15% (누적 95%)
        if (random < 95) return 3;
        // 4개: 4% (누적 99%)
        if (random < 99) return 4;
        // 5개: 0.9% (누적 99.9%)
        if (random < 99.9) return 5;
        // 6개: 0.1% (대박 - 폐허 속 보물)
        return 6;
    }

    // Tier 2: 평균/일반 (Wealth 40 ~ 79)
    if (wealth < 80) {
        // 1개: 15%
        if (random < 15) return 1;
        // 2개: 25% (누적 40%)
        if (random < 40) return 2;
        // 3개: 35% (누적 75%)
        if (random < 75) return 3;
        // 4개: 15% (누적 90%)
        if (random < 90) return 4;
        // 5개: 8% (누적 98%)
        if (random < 98) return 5;
        // 6개: 2% (운수 좋은 날)
        return 6;
    }

    // Tier 3: 부유/사치 (Wealth 80 ~ 100)
    // 부자라고 무조건 6개가 아님을 보장
    // 1개: 5% (빈손 - 마음에 드는 게 없음)
    if (random < 5) return 1;
    // 2개: 10% (누적 15%)
    if (random < 15) return 2;
    // 3개: 20% (누적 35%)
    if (random < 35) return 3;
    // 4개: 30% (누적 65%)
    if (random < 65) return 4;
    // 5개: 20% (누적 85%)
    if (random < 85) return 5;
    // 6개: 15% (최대 - 사재기/쇼핑)
    return 6;
};

/**
 * 이모지 살균 함수 (Emoji Sanitizer)
 * AI가 간혹 한자(袋, 劍)나 텍스트를 이모지 필드에 넣는 것을 방지.
 * 순수 이모지가 아닌 문자가 섞여 있으면 '📦'로 강제 치환.
 */
export const sanitizeEmoji = (input: string): string => {
    if (!input) return "📦";
    
    const trimmed = input.trim();
    
    // 한글, 영문, 숫자, 한자 등이 포함되어 있는지 검사 (이모지가 아닌 텍스트 감지)
    // \u4e00-\u9fa5 : 한자 범위
    const hasText = /[가-힣a-zA-Z0-9\u4e00-\u9fa5]/.test(trimmed);
    
    // 텍스트가 섞여 있다면 탈락
    if (hasText) {
        return "📦";
    }

    // 빈 문자열이면 탈락
    if (trimmed.length === 0) {
        return "📦";
    }

    return trimmed;
};