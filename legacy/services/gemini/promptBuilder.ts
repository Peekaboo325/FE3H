
import { NarrativeContext, InstructionBlock, CompendiumEntry } from '../../types/index';
import { 
  AU_GUIDELINES, STRICT_TERMINOLOGY, STYLE_GUIDELINES, 
  FODLAN_PROPER_NOUNS, FODLAN_MONTHS_GUIDE, ALIAS_NARRATIVE_GUIDELINES, 
  ADDRESS_PROTOCOL, PERIOD_CONTEXTS
} from '../../core.constants';
import { 
  buildCharacterContext, 
  buildRecallEvidence, 
  buildEpisodeReference, 
  buildExplicitCompendiumReference,
  buildStoryInstructions,
  buildWorldState
} from './context';

/**
 * [Restored] Prompt Builder
 * 모든 설정 데이터와 출력 양식 규정을 하나로 조립합니다.
 */
export const assembleNarrativePrompt = (ctx: NarrativeContext): string => {
    const blocks: InstructionBlock[] = [];

    // 1. 세계관 및 문체 기초 (Priority 0)
    const resetSignal = ctx.isSessionReset 
        ? "\n[SYSTEM: SESSION_HARD_RESET] 이전 서사의 모든 맥락과 기억이 소각되었습니다. 과거의 인과에 얽매이지 말고, 현재 제공된 설정과 캐릭터 프로필만을 바탕으로 완전히 새로운 서사를 시작하십시오.\n" 
        : "";

    blocks.push({
        priority: 0,
        tag: 'CORE',
        content: `
${resetSignal}
당신은 '파이어 엠블렘 풍화설월'의 기록자입니다.
${STRICT_TERMINOLOGY}
${STYLE_GUIDELINES}
${buildWorldState(ctx.period, ctx.lastFodlanDate)}
${ADDRESS_PROTOCOL}
${AU_GUIDELINES}
${ALIAS_NARRATIVE_GUIDELINES}
${FODLAN_PROPER_NOUNS}
`
    });


    // 2. 캐릭터 프로필 (Priority 1)
    blocks.push({
        priority: 1,
        tag: 'CHARACTERS',
        content: buildCharacterContext(ctx.characters)
    });

    // 3. 기억 및 연대기 증거 (Priority 2)
    const evidence = buildRecallEvidence(ctx.autoRecalledChronicles, ctx.structuredMemories);
    if (evidence) {
        blocks.push({
            priority: 2,
            tag: 'RECALL',
            content: evidence
        });
    }

    // 3.5. 명시적 에피소드 전체 내용 참조 (Priority 2.5)
    const epRef = buildEpisodeReference(ctx.referencedEpisodeContent, ctx.isDeepRecall || false);
    if (epRef) {
        blocks.push({
            priority: 2.5,
            tag: 'EPISODE_REFERENCE',
            content: epRef
        });
    }

    // 3.6. 명시적 견문록 참조 (Priority 2.6)
    const compRef = buildExplicitCompendiumReference(ctx.referencedCompendiumContent);
    if (compRef) {
        blocks.push({
            priority: 2.6,
            tag: 'COMPENDIUM_REFERENCE',
            content: compRef
        });
    }

    // 4. 출력 양식 규정 (Priority 3 - CRITICAL)
    const nextEp = ctx.nextEpisode || "[숫자]";
    blocks.push({
        priority: 3,
        tag: 'FORMAT',
        content: `
[작업 순서 (Internal Workflow)]
본문을 작성하기 전에 반드시 내부적으로 다음 단계를 거치십시오. (이 과정은 절대 출력하지 마십시오.)
1. **오감 데이터 추출**: 현재 장면에서 인물이 느낄 수 있는 오감 중 가장 강렬한 것 3가지를 선정하십시오.
2. **심연의 정의**: 인물이 외면하고 있는 '말하지 못하는 속마음'을 정의하십시오.
3. **단일 본문 집필**: 위 데이터를 바탕으로 '설명'을 배제하고 오직 '묘사'와 '대사'만으로 **단 하나의 완성된 본문**을 작성하십시오.
4. **제목 선정 (Internal Only)**: 본문을 다 작성한 후, [제목 작성 지침]에 따라 제목 후보 3개를 내부적으로 생성하십시오. 그중 가장 부합하는 **하나**를 최종 선택하십시오.
   - **주의**: 후보 생성 및 선택 과정은 당신의 생각 속에서만 수행하며, 최종 답변에는 **선택된 단 하나의 제목과 본문**만 포함해야 합니다.

[MANDATORY OUTPUT FORMAT - 절대 준수]
당신은 반드시 다음의 마크다운 형식을 첫 줄부터 지켜야 합니다. **여러 개의 후보나 원고를 나열하는 것을 엄격히 금지합니다.**

### ${nextEp}화 : [최종 선택된 제목]
<sub>제국력 [년]년 [포드라 월 이름] [일]일 - [시간대]</sub>

---

[단 하나의 본문 서사 내용]
${buildStoryInstructions(ctx.storyParams, ctx.customPrompt)}

[작성 규칙]
1. **단일 출력 원칙**: 한 번의 답변에는 반드시 **단 하나의 에피소드(### ${nextEp}화)**만 포함하십시오. 여러 버전의 원고를 연속해서 출력하는 것은 심각한 오류입니다.
2. **사족 금지**: "알겠습니다", "제목 후보입니다" 등의 멘트를 절대 출력하지 마십시오. 오직 최종 결과물만 출력하십시오.
`
    });

    return blocks
        .sort((a, b) => a.priority - b.priority)
        .map(b => b.content)
        .join('\n');
};

export { buildCompendiumContext as formatCompendiumPrompt } from './context';
