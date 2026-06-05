
import { AppState } from '../../store/types';
import { OptimizedContext, Message, ChronicleEntry, MemoryEntry } from '../../types/index';
import { estimateTokens } from '../../utils/tokenUtils';
import { recallRelevantMemories } from '../../utils/memoryUtils';
import { matchesSmartly } from '../system/searchEngine';
import { db } from '../../utils/db';

/**
 * [Restored] Context Optimizer
 * 서사의 일관성을 위해 과거의 기록과 기억을 정밀하게 추출하여 AI에게 전달합니다.
 */
export const getOptimizedContext = async (
    input: string,
    state: AppState, 
    episodeNum: number
): Promise<OptimizedContext> => {
    
    const { messages, chronicles, useSituationalAwareness, compendium } = state;

    // 1. 명시적 에피소드 참조 감지 (멀티 및 범위 지원)
    let referencedEpisodeContent: string | undefined = undefined;
    let targetEpisodes: number[] = [];

    // 범위 인식 (예: 79~81화 참고)
    const rangeMatch = input.match(/(\d+)\s*[~-]\s*(\d+)화\s*(?:참고|참조)/);
    if (rangeMatch) {
        const start = parseInt(rangeMatch[1], 10);
        const end = parseInt(rangeMatch[2], 10);
        for (let i = Math.min(start, end); i <= Math.max(start, end); i++) {
            targetEpisodes.push(i);
        }
    } else {
        // 다중 번호 인식 (예: 79, 80, 81화 참고)
        const multiMatch = input.match(/((?:\d+[\s,]*)+)화\s*(?:참고|참조)/);
        if (multiMatch) {
            const nums = multiMatch[1].match(/\d+/g);
            if (nums) {
                targetEpisodes = nums.map(n => parseInt(n, 10));
            }
        }
    }

    // 중복 제거 및 정렬
    if (targetEpisodes.length > 0) {
        targetEpisodes = Array.from(new Set(targetEpisodes)).sort((a, b) => a - b);
    }

    // 딥리콜 모드 판정: 2개 이상의 에피소드 참조 시 활성화
    const isDeepRecall = targetEpisodes.length >= 2;

    // 2. 동적 컨텍스트 제한 설정 (딥리콜 모드 시 축소)
    const memoryLimit = isDeepRecall ? 1 : 5;
    const chronicleLimit = isDeepRecall ? 1 : 3;
    const historyLimit = isDeepRecall ? 8 : 20;

    // 3. 키워드 추출 (간이 명사 추출)
    const tags = input.match(/[가-힣]{2,}/g) || [];
    
    // 4. 기억(Memory) 소환
    const relevantMemories = useSituationalAwareness 
        ? await recallRelevantMemories(tags, memoryLimit)
        : [];

    // 5. 연대기(Chronicle) 소환
    const relevantChronicles = useSituationalAwareness
        ? chronicles.filter((c: ChronicleEntry) => 
            tags.some(tag => matchesSmartly(c.title, tag) || c.key_events.some(e => matchesSmartly(e, tag)))
          ).slice(-chronicleLimit)
        : [];

    // 6. 히스토리 클리핑 (최근 대화 맥락 보존)
    const visibleMessages = messages.filter((m: Message) => !m.isHidden);
    const contextHistory = (visibleMessages.length > 0 && visibleMessages[visibleMessages.length - 1].role === 'user')
        ? visibleMessages.slice(0, -1)
        : visibleMessages;

    const finalHistory = contextHistory.slice(-historyLimit);

    // 7. 에피소드 본문 데이터 추출
    if (targetEpisodes.length > 0) {
        const allMsgs = await db.getMessages();
        const combinedContent: string[] = [];

        for (const targetEp of targetEpisodes) {
            let inTargetEp = false;
            const epMsgs: string[] = [];
            
            for (const m of allMsgs) {
                if (m.role === 'model') {
                    const match = m.content.match(/###\s*(\d+)화/);
                    if (match) {
                        const currentEp = parseInt(match[1], 10);
                        if (currentEp === targetEp) {
                            inTargetEp = true;
                        } else if (inTargetEp) {
                            break;
                        }
                    }
                }
                if (inTargetEp && !m.isHidden) {
                    epMsgs.push(`[${m.role === 'user' ? 'USER' : 'STORY'}] ${m.content}`);
                }
            }
            if (epMsgs.length > 0) {
                combinedContent.push(`--- [제 ${targetEp}화 기록] ---\n${epMsgs.join('\n')}`);
            }
        }
        
        if (combinedContent.length > 0) {
            referencedEpisodeContent = combinedContent.join('\n\n');
        }
    }

    // 8. 명시적 견문록 참조 감지
    let referencedCompendiumContent: string | undefined = undefined;
    
    // 권수 기반 매칭 (제n권 참조)
    const volRefMatch = input.match(/제(\d+)권\s*참조/);
    if (volRefMatch) {
        const targetVol = parseInt(volRefMatch[1], 10);
        const sortedCompendium = [...compendium].sort((a, b) => (a.order || a.timestamp) - (b.order || b.timestamp));
        const targetEntry = sortedCompendium[targetVol - 1];
        if (targetEntry) {
            referencedCompendiumContent = `[견문록 제${targetVol}권: ${targetEntry.title}]\n` + 
                targetEntry.sections.map(s => `#### ${s.subtitle}\n${s.content}`).join('\n');
        }
    } 
    // 제목 기반 매칭 ([제목] 참조)
    else {
        const titleRefMatch = input.match(/\(([^)]+)\s*참조\)/);
        if (titleRefMatch) {
            const targetTitle = titleRefMatch[1].trim();
            // 에피소드 참조(n화)가 아닐 때만 견문록 검색
            if (!targetTitle.match(/^\d+화$/)) {
                const targetEntry = compendium.find(c => matchesSmartly(c.title, targetTitle));
                if (targetEntry) {
                    referencedCompendiumContent = `[견문록 참조: ${targetEntry.title}]\n` + 
                        targetEntry.sections.map(s => `#### ${s.subtitle}\n${s.content}`).join('\n');
                }
            }
        }
    }

    return {
        relevantChronicles,
        relevantMemories,
        clippedHistory: finalHistory,
        referencedEpisodeContent,
        referencedCompendiumContent,
        tokenUsage: {
            total: 0, // 파이프라인에서 계산
            chronicle: relevantChronicles.reduce((s, c) => s + estimateTokens(c.summary), 0),
            memory: relevantMemories.reduce((s, m) => s + estimateTokens(m.content), 0),
            history: finalHistory.reduce((s, m) => s + estimateTokens(m.content), 0)
        },
        complexityScore: tags.length + (relevantMemories.length * 2) + (referencedEpisodeContent ? 10 : 0) + (referencedCompendiumContent ? 10 : 0),
        routingHint: { forcePro: relevantMemories.length > 2 || !!referencedEpisodeContent || !!referencedCompendiumContent },
        isDeepRecall // 딥리콜 활성화 여부 전달
    } as any;
};
