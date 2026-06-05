
import { CharacterProfile } from '../types/index';
import { STATS_ANALYSIS_LOGIC } from './stats.logic';
import { HASHTAG_LOGIC_SECTION, PERSONALITY_LOGIC_SECTION, REPUTATION_LOGIC_SECTION, SIGNATURE_QUOTE_LOGIC } from './narrative.logic';
import { QUESTS_ANALYSIS_LOGIC } from './quests.logic';
import { getItemsLogic } from './items.logic';
import { FODLAN_PROPER_NOUNS } from '../core.constants';

const BOND_THEME_LOGIC = `
[BOND THEME ANALYSIS ENGINE]
- 'bonds_info'에 제공된 인연 목록의 문맥을 분석하여 가장 적절한 'theme'을 부여하십시오.
- 테마 분류 규칙:
  * rose: 연애, 혼약, 깊은 애정, 심쿵
  * crimson: 가족, 혈연, 부모자식, 스승, 유사 가족적 유대
  * emerald: 우정, 동료애, 소꿉친구, 신뢰하는 벗
  * azure: 주종 관계, 충성, 기사도, 공적인 보호
  * violet: 적대, 배신, 증오, 정적, 경계 대상
  * amber: 계약, 이해관계, 전략적 협력, 비즈니스
  * slate: 지인, 데면데면한 사이, 소원함, 일반 관계
`;

/**
 * [Standard Analysis Prompt v5.0: Reciprocity Enabled]
 */
export const getStandardAnalysisPrompt = (
    char: CharacterProfile, 
    context: string, 
    bondsInfo: string, 
    externalBondsInfo: string, // [NEW] 타인이 기록한 인연 정보
    customInstruction?: string
) => `
Analyze the character "${char.name}" (Core Profile, Report, Quests & Relationships) based on their profile, narrative context, and external reputation.

${customInstruction ? `
[USER'S DIRECTIVE - TOP PRIORITY]
"${customInstruction}"
` : ""}

[PROFILE]
${char.description}
(CRITICAL: Prioritize the CUSTOM PROFILE over Game Canon.)

[RELATIONSHIP DATA (MY VIEW)]
${bondsInfo || "(기록된 인연 없음)"}

[EXTERNAL REPUTATION (OTHERS' VIEW - RECIPROCITY ENGINE)]
${externalBondsInfo || "(타 유닛의 명부에 기록된 당신에 대한 정보가 없습니다.)"}
- **Instruction**: 타 유닛들이 당신을 어떻게 정의하고 있는지(예: 첫사랑, 숙적, 은인 등)를 분석 보고서와 임무 생성에 적극 반영하십시오.

[CONTEXT LOG]
${context}

${BOND_THEME_LOGIC}

REQUIREMENTS:
1. **analyzed_english_name**: Official English spelling from 'Fire Emblem: Three Houses' canon.

${HASHTAG_LOGIC_SECTION}

${PERSONALITY_LOGIC_SECTION}

${SIGNATURE_QUOTE_LOGIC}

${REPUTATION_LOGIC_SECTION}

${STATS_ANALYSIS_LOGIC}

${QUESTS_ANALYSIS_LOGIC}

[OUTPUT JSON STRUCTURE]
{
  "analyzed_name": "Full Name",
  "analyzed_english_name": "Official English Name",
  "title": "A short, distinct title",
  "hashtags": ["tag1", "tag2", "tag3", "tag4", "tag5"],
  "generated_quote": "Auto-generated signature quote...",
  "stats": {
    "prowess": 50, "magic": 50, "faith": 50, "intellect": 50, "influence": 50, "status": 50, "wealth": 50, "charm": 50, "resilience": 50
  },
  "stat_comments": {
    "prowess": "Comment...", "magic": "Comment...", "faith": "Comment...", "intellect": "Comment...", "influence": "Comment...", "status": "Comment...", "wealth": "Comment...", "charm": "Comment...", "resilience": "Comment..."
  },
  "personality_analysis": "Detailed analysis...",
  "unconscious_analysis": "Detailed analysis...",
  "reputation": [
    { "source": "Source Name", "category": "Category", "comment": "Comment..." },
    ... (Total 6 items)
  ],
  "quests": [
    { "type": "Duty", "name": "Title", "description": "1st person monologue", "reward": "Reward" }
  ],
  "bond_themes": {
    "BOND_ID_HERE": "rose | crimson | emerald | azure | violet | amber | slate"
  }
}
`;

/**
 * [Inventory Prompt]
 */
export const getItemPrompt = (char: CharacterProfile, context: string, aliasesInfo: string, customInstruction?: string, targetCount: number = 3) => {
  const existingItems = char.analysis?.belongings?.map(item => item.name) || [];
  
  return `
Generate Inventory (Belongings) for "${char.name}".
[CONTEXT LOG]
${context}
REQUIREMENTS:
${getItemsLogic(targetCount, existingItems)}
[OUTPUT JSON STRUCTURE]
{
  "belongings": [
    { "name": "Item Name", "emoji": "📦", "comment": "Description..." }
  ]
}
`;
};
