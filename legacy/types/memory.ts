
/**
 * [PR #5/6] Memory Consolidation Protocol
 * '성인의 서고'에 영구 보존될 구조화된 기억 데이터의 타입을 정의합니다.
 */

export type MemoryType = 'fact' | 'preference' | 'relationship' | 'status';

export interface MemoryEntry {
  id: string;
  type: MemoryType;
  content: string; // 압축된 한국어 문장 (최대 60자 권장)
  tags: string[]; // 검색 및 소환용 핵심 명사 배열
  importance: number; // 1~5 (소환 우선순위)
  source_episodes: number[]; // 해당 기억이 추출된 원본 회차 번호
  timestamp: number; // 기록 시점
  isContradicted?: boolean; // [모순 탐지] 플래그
}

/**
 * [PR #6] Engine Result Types
 */
export interface MemoryConsolidationResult {
  memories: Omit<MemoryEntry, 'id' | 'timestamp'>[];
}
