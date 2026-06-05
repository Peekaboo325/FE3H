
import { PERIOD_CONTEXTS, FODLAN_MONTHS_GUIDE } from '../../../core.constants';
import { Period } from '../../../types/index';
import { getStoryParamInstructions } from '../../../story.logic';

/**
 * [Phase 2-D] World Context Builder
 * 세계관 설정, 시점, 시스템 지침을 조립합니다.
 */

export const buildWorldState = (period: Period, lastDate?: string): string => {
  const temporalAnchor = lastDate 
    ? `\n[TEMPORAL ANCHOR] 현재 시점은 반드시 '${lastDate}' 이후여야 합니다. 제국력의 연도와 월은 순방향으로만 흘러야 하며, 이전 날짜로 역주행하는 것은 엄격히 금지됩니다.`
    : "";

  return `
[현재 세계관 데이터 (World State)]
- 시점: ${period}${temporalAnchor}
${PERIOD_CONTEXTS[period] || ''}
${FODLAN_MONTHS_GUIDE}
`;
};

export const buildStoryInstructions = (storyParams: any, customPrompt?: string): string => {
  let instructions = `\n[서술 지침]\n${getStoryParamInstructions(storyParams)}`;
  if (customPrompt) {
    instructions += `\n\n[사용자 정의 규칙]\n${customPrompt}`;
  }
  return instructions;
};
