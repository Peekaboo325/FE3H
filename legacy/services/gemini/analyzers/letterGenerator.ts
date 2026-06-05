
import { Letter } from '../../../types/index';
import { callGeminiWithRetry, SAFETY_SETTINGS, cleanAndParseJSON } from '../client';
import { LETTER_PROMPT, getLetterGenerationContext } from '../prompts';

/**
 * [Phase 2-A] Letter Generator Analyzer
 * AI를 사용하여 캐릭터 간의 서신을 생성합니다.
 */

export const generateLetters = async (
    sender: any,
    receiver: any,
    recentMessages: any[],
    bonds: any,
    compendium: any[],
    previousLetters: any[],
    slotCount: number,
    onRetry?: (msg: string) => void,
    storyParams?: any,
    replyToId?: string,
    allCharacterNames?: string[],
    forcedType?: string,
    recentTypes?: string[],
    customPrompt?: string
): Promise<Letter[]> => {
    const relevantCompendium = compendium.filter(entry => {
        const lowerTitle = entry.title.toLowerCase();
        const senderName = sender.name.toLowerCase();
        const receiverName = receiver.name.toLowerCase();
        const senderFirst = senderName.split(' ')[0];
        const receiverFirst = receiverName.split(' ')[0];
        
        return lowerTitle.includes(senderName) || 
               lowerTitle.includes(receiverName) || 
               lowerTitle.includes(senderFirst) || 
               lowerTitle.includes(receiverFirst) ||
               entry.isGlobal; // 전역 설정은 유지
    }).slice(0, 10); // 최대 10개로 제한

    const systemInstruction = LETTER_PROMPT + 
        (customPrompt ? `\n\n### [USER INSTRUCTION] (최우선 준수)\n${customPrompt}` : "") +
        `\n\n[SLOT CONSTRAINT] 이번 요청에서는 최대 ${slotCount}개의 서신을 생성할 수 있습니다. 상황에 따라 0개를 생성(답장 거부 등)할 수도 있습니다.` + 
        (replyToId ? `\n\n[REPLY CONTEXT] 이 서신은 ID ${replyToId}인 서신에 대한 답장입니다. 원문의 톤과 내용을 고려하여 적절히 응답하거나, 캐릭터의 성격상 답장이 부적절하다면 생성하지 마십시오.` : "") +
        (forcedType ? `\n\n[TYPE CONSTRAINT] 이번 서신의 유형은 반드시 '${forcedType}'이어야 합니다.` : "") +
        (recentTypes && recentTypes.length > 0 ? `\n\n[VARIETY CONSTRAINT] 최근에 발송된 서신 유형들(${recentTypes.join(', ')})과 가급적 중복되지 않도록 다른 유형을 선택하십시오.` : "");
    
    // 데이터 다이어트: 최근 대화 20개로 확장, 관련 사전 항목만 전달
    const userPrompt = getLetterGenerationContext(sender, receiver, recentMessages.slice(-20), bonds, relevantCompendium, previousLetters.slice(-5), storyParams);

    const contents = [
        { role: 'user', parts: [{ text: userPrompt }] }
    ];

    try {
        const response = await callGeminiWithRetry({
            model: 'gemini-flash-latest', // 플랫폼 표준 명칭으로 수정하여 404 에러 해결
            contents,
            config: {
                systemInstruction,
                temperature: 0.9,
                responseMimeType: 'application/json',
                safetySettings: SAFETY_SETTINGS
            }
        }, onRetry);

        const text = response.text || "[]";
        const parsed = cleanAndParseJSON(text);
        
        // Ensure it's an array
        const lettersArray = Array.isArray(parsed) ? parsed : [parsed];
        
        // Map to Letter type and add IDs/Timestamps
        return lettersArray.map((l: any, index: number) => {
            // AI가 ID를 잘못 생성하거나 누락하는 것을 방지하기 위해 
            // 호출 시 전달된 sender와 receiver의 ID를 강제로 주입합니다.
            // 답장(replyToId)인 경우에도 이미 sender/receiver가 올바르게 순서가 바뀌어 전달되므로 동일하게 적용합니다.
            const finalSenderId = sender.id;
            const finalReceiverId = receiver.id;

            // [Signature Guard] 빙의 방지 및 창의적 서명 허용 정책
            // 1. 다른 네임드 캐릭터의 이름이 명시적으로 포함되어 있다면 차단 (빙의 방지)
            // 2. 발신자 본인의 정체성(이름, 직함, 관계적 호칭)을 나타내는 표현은 모두 허용
            // 3. 영문 이름만 있는 경우 한글 이름으로 보정하되, 이니셜이나 창의적 수식어는 유지
            
            let signature = l.signature || '';
            const senderName = sender.name;
            const otherNames = (allCharacterNames || []).filter(name => name !== senderName);
            
            // 타인 빙의 여부 확인 (가장 강력한 차단 조건)
            const isOtherCharacter = otherNames.some(name => signature.includes(name));
            
            if (isOtherCharacter) {
                // 명백한 타인 빙의이므로 공식 이름으로 강제 교체
                signature = senderName;
            } else if (!signature) {
                // 서명이 없는 경우 기본 이름 사용
                signature = senderName;
            } else {
                // [Fix] 영문 이름 부분 치환 (한글 우선 정책 유지)
                const englishName = sender.english_name;
                if (englishName && englishName.length > 2) {
                    const regex = new RegExp(englishName, 'gi');
                    if (regex.test(signature)) {
                        signature = signature.replace(regex, senderName);
                    }
                }
            }

            return {
                id: `letter-${Date.now()}-${index}`,
                senderId: finalSenderId,
                receiverId: finalReceiverId,
                type: l.type || 'letter',
                status: l.status || 'sent',
                title: sanitizeTitle(l.title || '제목 없음'),
                content: applyStrictTerminology(l.content || '서신 내용이 없습니다.'),
                signature: sanitizeName(signature),
                recipient_name: sanitizeName(l.recipient_name || receiver.name),
                timestamp: Date.now() - (index * 1000), // Slightly different timestamps for sorting
                isSealed: l.status === 'sent', // Drafts are not sealed
                replyToId: replyToId
            };
        }).filter((l: Letter) => l.senderId !== l.receiverId);
    } catch (error) {
        console.error("[LETTER_GEN] Generation failed:", error);
        return [];
    }
};

/**
 * [Phase 2-L] Strict Terminology Enforcement (Post-processing)
 * AI가 실수하기 쉬운 고유명사를 강제로 치환합니다.
 */
const applyStrictTerminology = (text: string): string => {
    let corrected = text;
    const rules = [
        { wrong: /퍼디아/g, right: '페르디아' },
        { wrong: /포들란/g, right: '포드라' },
        { wrong: /폴드라/g, right: '포드라' },
        { wrong: /대주교 레아/g, right: '대사교 레아' },
        { wrong: /가르그 마크 기사단/g, right: '세이로스 기사단' }
    ];

    rules.forEach(rule => {
        corrected = corrected.replace(rule.wrong, rule.right);
    });

    return corrected;
};

/**
 * 수신인/발신인 이름에서 경어(올림, 드림, 에게 등) 제거 (Hard-filtering)
 */
const sanitizeName = (name: string): string => {
    if (!name) return "";
    // '올림', '드림', '배상', '에게', '께', '귀하', '앞' 등이 단어 끝에 붙어있을 경우 제거 (공백 포함)
    return name.replace(/\s*(올림|드림|배상|에게|께|귀하|앞)$/, '').trim();
};

/**
 * 제목에서 특수문자 및 괄호 제거 (Hard-coding filter)
 */
const sanitizeTitle = (title: string): string => {
    return title.replace(/[()\[\]{}]/g, '').trim();
};
