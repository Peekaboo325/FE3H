
import { CharacterProfile, CharacterAnalysis, BelongingItem } from '../types/index';
import { generateId } from '../utils/textUtils';

/**
 * [Phase 2-Q] Data Quarantine Logic
 */
export const processAnalysisResult = (
    char: CharacterProfile,
    partialAnalysis: Partial<CharacterAnalysis>,
    section: 'items' | 'standard'
): CharacterAnalysis => {
    
    const existing: CharacterAnalysis = char.analysis || {
        analyzed_name: char.name,
        title: '데이터 분석 중',
        hashtags: [],
        stats: { prowess: 0, magic: 0, faith: 0, intellect: 0, influence: 0, status: 0, wealth: 0, charm: 0, resilience: 0 },
        personality_analysis: "",
        unconscious_analysis: "",
        reputation: [],
        stat_comments: { prowess: "", magic: "", faith: "", intellect: "", influence: "", status: "", wealth: "", charm: "", resilience: "" },
        quests: [],
        belongings: [],
        timestamp: 0
    };

    let finalAnalysis: CharacterAnalysis;

    if (section === 'items') {
        let mergedBelongings: BelongingItem[] = existing.belongings || [];
        if (partialAnalysis.belongings) {
            const oldItems = mergedBelongings.map(item => ({ ...item, isNew: false }));
            const newItems = partialAnalysis.belongings.map(item => {
                // [PO's SPEC] 소지품 생성 규정 준수 (설명 25자, 1문장 제한)
                let name = item.name || "알 수 없는 물건";

                let comment = item.comment || "";
                // 첫 문장만 추출 및 중복 마침표 방지
                const match = comment.match(/^[^.!?]+[.!?]?/);
                comment = match ? match[0].trim() : comment.trim();
                
                // 마침표가 없고 비어있지 않다면 마침표 추가
                if (comment && !/[.!?]$/.test(comment)) {
                    comment += '.';
                }
                
                if (comment.length > 25) comment = comment.substring(0, 25);

                return { 
                    ...item, 
                    name,
                    comment,
                    stableId: item.stableId || generateId(),
                    isNew: true 
                };
            });
            mergedBelongings = [...newItems, ...oldItems];
        }
        finalAnalysis = { ...existing, belongings: mergedBelongings };
    } else {
        finalAnalysis = {
            ...existing,
            analyzed_name: partialAnalysis.analyzed_name || existing.analyzed_name,
            analyzed_english_name: partialAnalysis.analyzed_english_name || existing.analyzed_english_name,
            title: partialAnalysis.title || existing.title,
            hashtags: partialAnalysis.hashtags || existing.hashtags,
            generated_quote: partialAnalysis.generated_quote || existing.generated_quote,
            stats: { ...existing.stats, ...(partialAnalysis.stats || {}) },
            stat_comments: { ...(existing.stat_comments || {}), ...(partialAnalysis.stat_comments || {}) } as any,
            personality_analysis: partialAnalysis.personality_analysis || existing.personality_analysis,
            unconscious_analysis: partialAnalysis.unconscious_analysis || existing.unconscious_analysis,
            reputation: partialAnalysis.reputation || existing.reputation,
            quests: partialAnalysis.quests || existing.quests,
            bond_themes: partialAnalysis.bond_themes || existing.bond_themes, // [Phase AI-Label] 테마 데이터 유지
            belongings: existing.belongings
        };
    }
    
    if (finalAnalysis.belongings) {
        finalAnalysis.belongings = finalAnalysis.belongings.map(item => ({
            ...item,
            stableId: item.stableId || generateId()
        }));
    }

    finalAnalysis.timestamp = Date.now();
    return finalAnalysis;
};
