import { Message, CompendiumEntry } from '../../types/index';
import { ADVISOR_SYSTEM_PROMPT } from './prompts';
import { STRICT_TERMINOLOGY, STYLE_GUIDELINES } from '../../core.constants';
import { callGeminiWithRetry, SAFETY_SETTINGS, isKoreanText, KOREAN_ENFORCEMENT_MSG } from './client';
import { buildCompendiumContext } from './context';

/**
 * [Phase 4-3: Optimized Facade] 
 * Advisor Engine: Pure logic for tactical advice.
 */

export const advisorChat = async (
    history: Message[], 
    userInput: string,
    worldContext: {
        activeUnits: string;
        chronicleSummary: string;
        recentNarrative: string;
        guidelines: string;
        period: string;
        compendium?: CompendiumEntry[];
        referencedEpisodeContent?: string; // [NEW] 딥 리콜 지원
        referencedCompendiumContent?: string; // [NEW] 딥 리콜 지원
    }
): Promise<string> => {
    let dynamicInstruction = ADVISOR_SYSTEM_PROMPT;
    dynamicInstruction += `\n\n[현재 세계관 데이터 (World State)]`;
    dynamicInstruction += `\n- 시점: ${worldContext.period}`;
    dynamicInstruction += `\n- 활성화된 유닛 목록 및 프로필:\n${worldContext.activeUnits}`;
    dynamicInstruction += `\n\n[최근 서사 내용 (Recent Narrative)]\n${worldContext.recentNarrative}`;

    if (worldContext.referencedEpisodeContent) {
        dynamicInstruction += `\n\n[참조된 과거 기록 (Deep Recall)]\n${worldContext.referencedEpisodeContent}`;
    }

    if (worldContext.referencedCompendiumContent) {
        dynamicInstruction += `\n\n[참조된 견문록 기록]\n${worldContext.referencedCompendiumContent}`;
    }

    dynamicInstruction += `\n\n[과거 연대기 요약]\n${worldContext.chronicleSummary}`;
    
    // [PO's SPEC] 견문록 데이터 주입 (전체 목록)
    if (worldContext.compendium && worldContext.compendium.length > 0) {
        dynamicInstruction += buildCompendiumContext(worldContext.compendium);
    }

    dynamicInstruction += `\n\n[절대 준수 가이드라인]\n${worldContext.guidelines}`;

    const contents = history.map(msg => ({
        role: msg.role === 'user' ? 'user' : 'model',
        parts: [{ text: msg.content }]
    }));
    contents.push({ role: 'user', parts: [{ text: userInput }] });

    let response = await callGeminiWithRetry({
        model: 'gemini-3-flash-preview',
        contents: contents,
        config: {
            systemInstruction: dynamicInstruction,
            temperature: 0.8,
            safetySettings: SAFETY_SETTINGS,
        }
    });
    
    let text = response.text || "";

    if (text.length > 20 && !isKoreanText(text)) {
        try {
            response = await callGeminiWithRetry({
                model: 'gemini-3-flash-preview',
                contents: contents,
                config: {
                    systemInstruction: dynamicInstruction + KOREAN_ENFORCEMENT_MSG,
                    safetySettings: SAFETY_SETTINGS,
                }
            });
            text = response.text || "";
        } catch (e) {}
    }

    return text;
};

/**
 * [Phase 4-3] 고정 컨텍스트 기반 전술 상담 (Legacy Support)
 */
export const getTacticalAdvice = async (input: string): Promise<string> => {
    return advisorChat([], input, {
        activeUnits: "정보 없음",
        chronicleSummary: "정보 없음",
        recentNarrative: "정보 없음",
        guidelines: STRICT_TERMINOLOGY + "\n" + STYLE_GUIDELINES,
        period: "Part I"
    });
};