
import { CharacterProfile, Message, CompendiumEntry, BondTheme, CharacterAnalysis } from '../../../types/index';
import { getStandardAnalysisPrompt, getItemPrompt } from '../../../analysis/index';
import { callGeminiWithRetry, SAFETY_SETTINGS } from '../client';
import { formatCompendiumPrompt } from '../promptBuilder';
import { extractFirstName } from '../../../utils/textUtils';
import { validateJsonResponse } from '../validators';

/**
 * [Narrative Isolation] 캐릭터의 서사 참여 등급을 산출합니다.
 */
const calculateInvolvementGrade = (char: CharacterProfile, currentEp: number): 'A' | 'B' | 'C' | 'D' => {
    if (char.is_exited) return 'D';
    
    const lastApp = char.last_appearance_ep || 0;
    const lastMent = char.last_mention_ep || 0;
    
    if (lastApp === 0 && lastMent === 0) return 'D'; // 신규/무관

    const diffApp = currentEp - lastApp;
    const diffMent = currentEp - lastMent;

    if (diffApp <= 2) return 'A'; // 직접 출연
    if (diffMent <= 5) return 'B'; // 간접 언급
    if (diffApp <= 10) return 'C'; // 지리적 인접/잔상
    return 'D'; // 서사적 격리
};

/**
 * [Narrative Isolation] 등급에 따른 컨텍스트 살균(Sanitization)
 */
const sanitizeContextByGrade = (context: string, grade: 'A' | 'B' | 'C' | 'D', lastEp: number): string => {
    if (grade === 'D') {
        return `[SYSTEM: NARRATIVE ISOLATION] 이 캐릭터는 현재 메인 서사와 완벽히 분리되어 있습니다. Ep.${lastEp} 이후의 기록을 전송하지 않습니다.`;
    }
    if (grade === 'C') {
        return `[SYSTEM: NARRATIVE ISOLATION] 이 캐릭터는 메인 서사와 거리가 있습니다. 상세 사건(아이템 획득 등)을 제외한 일반적인 정세 정보만 참고하십시오.\n\n${context.substring(0, Math.floor(context.length * 0.3))}`;
    }
    return context;
};

/**
 * [Reciprocity Engine] 타인의 인연 기록에서 나를 언급한 내용을 역추적합니다.
 */
const findExternalBonds = (target: CharacterProfile, allChars: CharacterProfile[]): string => {
    if (!allChars || allChars.length === 0) return "";
    
    const results: string[] = [];
    const targetNames = new Set([
        target.name.trim().toLowerCase(),
        extractFirstName(target.name).toLowerCase(),
        target.english_name?.trim().toLowerCase(),
        ...(target.aliases?.map(a => a.trim().toLowerCase()) || [])
    ].filter(Boolean));

    allChars.forEach(other => {
        if (other.id === target.id) return;
        
        other.bonds?.forEach(bond => {
            const bName = bond.name.trim().toLowerCase();
            const bEng = bond.english_name?.trim().toLowerCase();
            const bFirstName = extractFirstName(bond.name).toLowerCase();

            if (targetNames.has(bName) || targetNames.has(bEng) || targetNames.has(bFirstName)) {
                const statusLabel = bond.life_status === 'deceased' ? '[사망으로 기록됨]' : bond.life_status === 'unknown' ? '[실종으로 기록됨]' : '[생존]';
                results.push(`- [${other.name}의 기록]: "${bond.description}" (관계: ${bond.category}, 상태: ${statusLabel})`);
            }
        });
    });

    return results.join('\n');
};

/**
 * [Phase 2-G] Character Analyzer Specialized Module
 */
export const analyzeCharacter = async (
    char: CharacterProfile, 
    contextMessages: Message[], 
    section: 'standard' | 'items', 
    customPrompt?: string,
    compendium: CompendiumEntry[] = [],
    allCharacters: CharacterProfile[] = []
): Promise<any> => {
    // 현재 에피소드 파악
    const EP_REGEX = /###\s*(\d+)화/;
    let currentEp = 0;
    for (let i = contextMessages.length - 1; i >= 0; i--) {
        const m = contextMessages[i].content.match(EP_REGEX);
        if (m) { currentEp = parseInt(m[1], 10); break; }
    }

    const grade = calculateInvolvementGrade(char, currentEp);
    const rawContext = contextMessages.slice(-30).map(m => `[${m.role}] ${m.content}`).join('\n');
    
    // [Narrative Isolation] 등급별 컨텍스트 필터링
    const contextStr = sanitizeContextByGrade(rawContext, grade, char.last_appearance_ep || 0);

    let prompt = "";
    if (section === 'items') {
        const aliasesInfo = char.aliases ? char.aliases.join(', ') : "";
        prompt = getItemPrompt(char, contextStr, aliasesInfo, customPrompt);
    } else {
        const bondsInfo = char.bonds?.map(b => {
            const statusLabel = b.life_status === 'deceased' ? '(사망)' : b.life_status === 'unknown' ? '(실종/불명)' : '';
            return `- Name: ${b.name}${statusLabel}, Category: ${b.category}, Desc: ${b.description}`;
        }).join('\n') || "None";
        
        const externalBondsInfo = findExternalBonds(char, allCharacters);
        prompt = getStandardAnalysisPrompt(char, contextStr, bondsInfo, externalBondsInfo, customPrompt);
        
        // 등급별 네거티브 지침 주입
        if (grade === 'D' || grade === 'C') {
            prompt += `\n\n[CRITICAL: KNOWLEDGE BARRIER (GRADE ${grade})]\n이 유닛은 현재 서사와 접점이 없거나 매우 낮습니다. 최신 로그에 등장하는 특정 아이템(예: 비스킷)이나 타인의 세부 행적을 아는 척하지 마십시오. 오직 본인의 배경 설정과 과거의 기억에만 충실히 분석 보고서를 작성하십시오.`;
        }
    }

    if (compendium.length > 0) {
        prompt += "\n\n" + formatCompendiumPrompt(compendium);
    }

    const response = await callGeminiWithRetry({
        model: 'gemini-3-flash-preview',
        contents: prompt,
        config: { 
            responseMimeType: 'application/json', 
            safetySettings: SAFETY_SETTINGS 
        }
    });

    const requiredFields: (keyof CharacterAnalysis)[] = section === 'items' ? ['belongings'] : ['analyzed_name', 'title', 'stats'];
    return validateJsonResponse<Partial<CharacterAnalysis>>(response.text || "{}", requiredFields);
};

/**
 * [Trigger B] 단일 인연 기록에 대한 실시간 테마 분류
 */
export const classifyBondTheme = async (category: string, description: string): Promise<BondTheme> => {
    const prompt = `
당신은 '파이어 엠블렘 풍화설월'의 서사 분석가입니다. 아래 관계의 문맥을 읽고 가장 어울리는 테마 하나만 골라 출력하십시오.
- rose: 연애 / crimson: 가족,혈연 / emerald: 우정 / azure: 주종 / violet: 적대 / amber: 계약 / slate: 지인
카테고리: ${category} / 상세설명: ${description}
오직 테마 이름만 한 줄로 출력하십시오.`;
    try {
        const response = await callGeminiWithRetry({
            model: 'gemini-3-flash-preview',
            contents: prompt,
            config: { temperature: 0.1, safetySettings: SAFETY_SETTINGS }
        });
        const theme = (response.text || "slate").trim().toLowerCase() as BondTheme;
        return ['rose', 'crimson', 'emerald', 'azure', 'violet', 'amber', 'slate'].includes(theme) ? theme : 'slate';
    } catch (e) { return 'slate'; }
};

/**
 * [PO's SPEC] 영문 성명 추천 AI 로직
 */
export const recommendEnglishName = async (koreanName: string): Promise<string> => {
    if (!koreanName.trim()) return "";
    const prompt = `입력된 한국어 이름 "${koreanName}"에 대한 최적의 영문 성명을 제안하십시오. (공식 영문명 우선). 이름만 출력하십시오.`;
    try {
        const response = await callGeminiWithRetry({
            model: 'gemini-3-flash-preview',
            contents: prompt,
            config: { temperature: 0.1, safetySettings: SAFETY_SETTINGS }
        });
        return (response.text || "").trim();
    } catch (e) { return ""; }
};
