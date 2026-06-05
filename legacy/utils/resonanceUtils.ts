import { ChronicleEntry } from '../types/index';

/**
 * [PR #3] Resonance Utils
 * 연대기 기록을 스캔하여 인물들 간의 최신 관계 상태(Relationship Matrix)를 추출합니다.
 */

export const extractRelationshipMatrix = (chronicles: ChronicleEntry[]): string => {
    if (!chronicles || chronicles.length === 0) return "확인된 관계 정보 없음";

    // 1. 관계 데이터 수집 (카테고리가 '관계'인 것만 추출)
    // 시간순으로 정렬된 기록을 순회하며 가장 최신 상태를 유지
    const latestRelationships: Record<string, string> = {};

    // 연대기는 이미 timestamp 순으로 정렬되어 있다고 가정 (또는 여기서 재정렬)
    const sortedChronicles = [...chronicles].sort((a, b) => a.timestamp - b.timestamp);

    sortedChronicles.forEach(entry => {
        entry.state_changes?.forEach(change => {
            if (change.category === '관계') {
                // 예: "에델가르트 -> 벨레트: 적대(최하)" 형식의 텍스트를 파싱하거나 그대로 저장
                // 여기서는 서사적 인과를 위해 문장 전체를 관계 키로 활용
                // 구체적인 타겟 분석을 위해 정규표현식 활용 가능
                const match = change.content.match(/^([^:]+):/);
                const subject = match ? match[1].trim() : "알 수 없는 인물";
                latestRelationships[subject] = change.content;
            }
        });
    });

    const results = Object.values(latestRelationships);

    if (results.length === 0) return "기록된 관계 변화가 없습니다. 원작의 기본 관계를 유지하십시오.";

    return results.map(r => `- ${r}`).join('\n');
};