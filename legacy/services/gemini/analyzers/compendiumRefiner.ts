
import { callGeminiWithRetry, SAFETY_SETTINGS } from '../client';
import { STRICT_TERMINOLOGY, STYLE_GUIDELINES } from '../../../core.constants';

/**
 * [PO's SPEC] Compendium Text Refiner
 * 유저가 입력한 내용을 바탕으로 문맥/문법/오탈자를 교정하고 고풍스러운 문체로 정제합니다.
 */
export const refineCompendiumText = async (text: string): Promise<string> => {
    if (!text.trim()) return "";

    const prompt = `
당신은 '파이어 엠블렘 풍화설월'의 궁정 기록관입니다. 유저가 입력한 세계관 설정을 정제하십시오.

[작동 원칙]
1. 내용 보존: 유저가 입력한 사실 관계(고유명사, 수치, 관계 등)를 절대 임의로 바꾸지 마십시오.
2. 문체 교정: 맞춤법, 띄어쓰기를 완벽하게 수정하고, 전체적으로 고풍스럽고 격조 있는 서술형 문체(~이다, ~한다)로 통일하십시오.
3. 비침습적 정제: 새로운 사실을 지어내지 말고, 오직 주어진 텍스트를 "가장 아름답고 정확한 기록"으로 다듬는 데만 집중하십시오.

[참고 가이드라인]
${STRICT_TERMINOLOGY}
${STYLE_GUIDELINES}

[대상 텍스트]
"${text}"

오직 정제된 본문만 출력하십시오.
`;

    try {
        const response = await callGeminiWithRetry({
            model: 'gemini-3-flash-preview',
            contents: prompt,
            config: { temperature: 0.2, safetySettings: SAFETY_SETTINGS }
        });
        return (response.text || "").trim();
    } catch (e) {
        console.error("[COMPENDIUM_REFINE] Failure", e);
        return text;
    }
};
