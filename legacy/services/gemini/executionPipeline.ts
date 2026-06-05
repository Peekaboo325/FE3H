
import { NarrativeContext } from '../../types/index';
import { callGeminiWithRetry, SAFETY_SETTINGS } from './client';
import { validateNarrativeQuality } from './validators';

/**
 * [Restored] Execution Pipeline
 * 생성과 검증을 통해 최상의 서사 결과물을 보장합니다.
 */
export const executeNarrativePipeline = async (
    ctx: NarrativeContext,
    systemInstruction: string
): Promise<string> => {
    const contents = ctx.history.map((msg) => ({
        role: msg.role === 'user' ? 'user' : 'model',
        parts: [{ text: msg.content }]
    }));
    contents.push({ role: 'user', parts: [{ text: ctx.newMessage }] });

    const modelName = ctx.modelType === 'pro' ? 'gemini-3-pro-preview' : 'gemini-3-flash-preview';
    
    // 에피소드 참조 시 온도를 낮추어(0.85 -> 0.6) 설정 왜곡 방지
    const initialTemperature = ctx.referencedEpisodeContent ? 0.6 : 0.85;

    // 1. 최초 생성 시도
    let response = await callGeminiWithRetry({
        model: modelName,
        contents,
        config: { 
            systemInstruction, 
            temperature: initialTemperature, 
            safetySettings: SAFETY_SETTINGS 
        }
    }, ctx.onRetryStatus);

    let content = response.text || "";

    // 2. 양식 및 품질 검증 (### 화, <sub> 태그, 날짜 역주행 체크)
    const validation = validateNarrativeQuality(content, ctx.nextEpisode, undefined, ctx.lastFodlanDate);

    if (!validation.isValid) {
        // 3. 양식 위반 시 재요청 (지침 강화, 별도의 안내 토스트 없이 정밀 모델로 재시도)
        let warning = "\n\n[WARNING] 반드시 ### 화 : 제목 및 <sub>...</sub> 양식을 지키십시오!";
        if (validation.reason === 'DATE_REGRESSION') {
            warning = `\n\n[CRITICAL ERROR] 날짜가 역주행했습니다. 현재 시점은 반드시 '${ctx.lastFodlanDate}' 이후여야 합니다!`;
        } else if (validation.reason === 'INVALID_YEAR_INCREMENT') {
            warning = `\n\n[CRITICAL ERROR] 연도 상승 규칙 위반! 포드라력에서 연도는 오직 '고월의 달(3월)'이 끝나고 '거목의 달(4월)'이 시작될 때만 상승합니다. 현재 '${ctx.lastFodlanDate}' 이후이므로 연도를 확인하십시오.`;
        } else if (validation.reason === 'MULTIPLE_MANUSCRIPTS') {
            warning = `\n\n[CRITICAL ERROR] 한 번의 답변에 여러 개의 원고가 출력되었습니다! 반드시 단 하나의 에피소드(### ${ctx.nextEpisode}화)만 출력하십시오. 제목 후보 생성 과정은 내부적으로만 처리하고 절대 출력하지 마십시오.`;
        }

        response = await callGeminiWithRetry({
            model: 'gemini-3-pro-preview', // 재시도는 정밀한 Pro 모델로 승격
            contents,
            config: { 
                systemInstruction: systemInstruction + warning, 
                temperature: 0.7, 
                safetySettings: SAFETY_SETTINGS 
            }
        }, ctx.onRetryStatus);
        
        content = response.text || content;
    }

    return content;
};
