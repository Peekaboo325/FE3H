import { Period, NarrativeContext } from '../../types/index';
import { parseFodlanDate } from '../../utils/dateUtils';
import { assembleNarrativePrompt } from './promptBuilder';
import { executeNarrativePipeline } from './executionPipeline';

/**
 * [Phase 2-F] Novel Engine: Narrative Orchestrator
 * 프롬프트 조립(Builder)과 실행(Pipeline)을 조율합니다.
 */

/**
 * 외부에서 사용하는 시간차 계산기 (Legacy Support)
 */
export const calculateTimeGap = (currentPeriod: Period, chronicleDate: string): string => {
    const parsed = parseFodlanDate(chronicleDate);
    if (!parsed) return "알 수 없는 과거";
    
    const currentYear = currentPeriod === 'part1' ? 1180 : 1185;
    const gap = currentYear - parsed.year;
    
    if (gap < 0) return "미래의 단편 (예언적 기록)";
    if (gap === 0) return "최근의 사건";
    if (gap > 0 && gap < 5) return `${gap}년 전의 일`;
    if (gap >= 5) return "5년 전, 사관학교 시절의 기억";
    return `${gap}년 전의 기록`;
};

/**
 * 시스템 지침 생성기 (Legacy Support)
 */
export const buildNovelSystemInstruction = (ctx: NarrativeContext): string => {
    return assembleNarrativePrompt(ctx);
};

/**
 * 메인 서사 생성 진입점
 */
export const sendMessageToGemini = async (ctx: NarrativeContext): Promise<string> => {
    // 1. Build
    const systemInstruction = assembleNarrativePrompt(ctx);
    
    // 2. Execute
    return await executeNarrativePipeline(ctx, systemInstruction);
};