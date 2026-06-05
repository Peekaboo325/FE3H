
import { Message, MemoryConsolidationResult } from '../../types/index';
import { MEMORY_EXTRACTION_PROMPT } from './prompts';
import { commitMemory } from '../../utils/memoryUtils';
import { callGeminiWithRetry, SAFETY_SETTINGS } from './client';
import { db } from '../../utils/db';
import { narrativeSyncQueue } from '../system/taskQueue';
import { validateJsonResponse } from './validators';

/**
 * [PR #6 / #6.1 / #Stable-Sync Update] Memory Consolidation Engine
 * 최근 AI 답변 내역에서 '기억의 핵'을 추출하여 서고에 비동기적으로 기록합니다.
 * [Stable-Sync] 태스크 큐를 통해 인과율 붕괴(레이스 컨디션)를 방지합니다.
 */

/**
 * 특정 에피소드의 기억을 완전히 동기화합니다. (기존 기억 삭제 -> 새 기억 추출)
 */
export const syncMemoriesForEpisode = async (messages: Message[], episodeNum: number): Promise<void> => {
    return narrativeSyncQueue.enqueue(async () => {
        console.debug(`[Stable-Sync] Synchronizing memories for Ep.${episodeNum}...`);
        
        // 1. 기존 에피소드 데이터 소각 (Atomic 처리를 위해 큐 내부에서 수행)
        await db.deleteMemoriesByEpisode(episodeNum);
        
        // 2. 사실 관계 재추출 실행
        await extractMemoriesInternal(messages, episodeNum);
    });
};

/**
 * 서사에서 사실 관계를 추출하여 IndexedDB에 저장합니다. (Internal Logic)
 * @param messages 전체 대화 내역
 * @param episodeNum 현재 회차 번호
 */
const extractMemoriesInternal = async (messages: Message[], episodeNum: number): Promise<void> => {
    const modelMessages = messages.filter(m => m.role === 'model' && !m.isHidden);
    if (modelMessages.length === 0) return;

    const recentNarrative = modelMessages.slice(-3).map(m => 
        `[STORY_RECORD] ${m.content}`
    ).join('\n');
    
    try {
        const response = await callGeminiWithRetry({
            model: 'gemini-3-flash-preview',
            contents: `[AI의 서사 기록]\n${recentNarrative}\n\n[대상 회차]: ${episodeNum}화`,
            config: { 
                systemInstruction: MEMORY_EXTRACTION_PROMPT,
                responseMimeType: 'application/json', 
                safetySettings: SAFETY_SETTINGS 
            }
        }, undefined, 3);

        const result = validateJsonResponse<MemoryConsolidationResult>(response.text || "{}", ['memories']);
        
        if (result.memories && Array.isArray(result.memories)) {
            let commitCount = 0;
            for (const mem of result.memories) {
                const memWithEp = { 
                    ...mem, 
                    source_episodes: mem.source_episodes && mem.source_episodes.length > 0 
                        ? mem.source_episodes 
                        : [episodeNum] 
                };
                
                await commitMemory(memWithEp);
                commitCount++;
            }
            console.debug(`[Stable-Sync] Consolidated ${commitCount} memories for Ep.${episodeNum}.`);
        }
    } catch (e) {
        console.error("[Stable-Sync] Internal Extraction Error:", e);
    }
};

/**
 * Legacy interface wrapper (For backward compatibility)
 */
export const extractMemoriesFromNarrative = async (messages: Message[], episodeNum: number): Promise<void> => {
    return syncMemoriesForEpisode(messages, episodeNum);
};
