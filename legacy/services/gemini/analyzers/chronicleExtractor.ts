import { Message, ChronicleField, ChronicleEntry } from '../../../types/index';
import { getChroniclePrompt } from '../prompts'; 
import { callGeminiWithRetry, SAFETY_SETTINGS } from '../client';
import { validateJsonResponse } from '../validators';

/**
 * [Phase 2-G] Chronicle Extractor Specialized Module
 * 대화 내역에서 서사적 사실을 추출하여 구조화된 연대기 데이터를 생성합니다.
 */
export const generateChronicle = async (
    history: Message[], 
    range: string, 
    field?: ChronicleField,
    modelOverride?: string
): Promise<Partial<ChronicleEntry>> => {
    // 지정된 범위의 모든 대화 내역을 분석 대상으로 사용
    const context = history.map(m => `[${m.role}] ${m.content}`).join('\n');
    const prompt = getChroniclePrompt(context, range, field);
    
    // 기본적으로 정밀한 Pro 모델을 사용하되, 필요 시 Flash 등으로 교체 가능
    const modelName = modelOverride || 'gemini-3.1-pro-preview';
    
    const response = await callGeminiWithRetry({
        model: modelName,
        contents: prompt,
        config: { 
            responseMimeType: 'application/json',
            safetySettings: SAFETY_SETTINGS
        }
    }, undefined, 3);

    const getRequiredFields = (f?: ChronicleField): (keyof ChronicleEntry)[] => {
        if (!f) return ['title', 'summary', 'key_events'];
        switch (f) {
            case 'meta': return ['title', 'state_changes'];
            case 'summary': return ['summary'];
            case 'key_events': return ['key_events'];
            case 'major_dialogues': return ['major_dialogues'];
            case 'tags': return ['tags'];
            case 'state_changes': return ['state_changes'];
            case 'seeds': return ['seeds'];
            default: return [];
        }
    };

    const requiredFields = getRequiredFields(field);
    return validateJsonResponse<Partial<ChronicleEntry>>(response.text || "{}", requiredFields);
};
