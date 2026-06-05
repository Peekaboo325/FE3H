import { MemoryEntry } from '../types/index';
import { db } from './db';
import { generateId } from './textUtils';

/**
 * [PR #5] Memory Management Utilities
 * '성인의 서고'에 대한 고수준 인터페이스를 제공합니다.
 */

/**
 * 새로운 기억을 서고에 안착시킵니다.
 * 중복된 내용(유사한 content)이 있을 경우 중요도를 갱신하거나 무시합니다.
 */
export const commitMemory = async (entry: Omit<MemoryEntry, 'id' | 'timestamp'>): Promise<void> => {
    const allMemories = await db.getAllMemories();
    
    // 단순 중복 체크 (공백 제거 후 내용 비교)
    const normalizedContent = entry.content.replace(/\s+/g, '');
    const isDuplicate = allMemories.some(m => m.content.replace(/\s+/g, '') === normalizedContent);
    
    if (isDuplicate) {
        console.debug("[PR #5] Duplicate memory detected, skipping commit.");
        return;
    }

    const finalEntry: MemoryEntry = {
        ...entry,
        id: generateId(),
        timestamp: Date.now()
    };

    await db.saveMemory(finalEntry);
};

/**
 * 입력된 텍스트(태그)와 가장 연관성이 높은 기억들을 소환합니다.
 * 중요도(Importance)와 최신성(Timestamp)을 가중치로 사용합니다.
 */
export const recallRelevantMemories = async (inputTags: string[], limit: number = 5): Promise<MemoryEntry[]> => {
    if (inputTags.length === 0) return [];
    
    const results = await db.getMemoriesByTags(inputTags);
    
    // 상위 N개만 반환
    return results.slice(0, limit);
};

/**
 * 특정 회차(Episode)에서 추출된 모든 기억을 찾습니다.
 */
export const getMemoriesByEpisode = async (episodeNumber: number): Promise<MemoryEntry[]> => {
    const all = await db.getAllMemories();
    return all.filter(m => m.source_episodes.includes(episodeNumber));
};