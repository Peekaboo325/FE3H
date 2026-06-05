
import { Message, ChronicleEntry, MemoryEntry } from '../../../types/index';
import { NON_INVASIVE_PROTOCOL, RECALL_EVIDENCE_TEMPLATE } from '../../../core.constants';

/**
 * [Phase 2-D] Narrative Context Builder
 * 대화 기록, 연대기, 기억 조각을 AI 서술에 적합하게 조립합니다.
 */

/**
 * 기억 및 연대기 증거 조립
 */
export const buildRecallEvidence = (
  chronicles: ChronicleEntry[] = [],
  memories: MemoryEntry[] = []
): string => {
  const evidenceList = [
    ...chronicles.map(c => `[과거 기록: ${c.range}] ${c.summary}`),
    ...memories.map(m => `[기억 조각] ${m.content}`)
  ];

  if (evidenceList.length === 0) return "";

  return `\n${NON_INVASIVE_PROTOCOL}\n${RECALL_EVIDENCE_TEMPLATE.replace('{EVIDENCE_LIST}', evidenceList.join('\n'))}`;
};

/**
 * 에피소드 참조 데이터 조립
 */
export const buildEpisodeReference = (content: string | undefined, isDeepRecall: boolean): string => {
  if (!content) return "";

  const deepRecallGuidance = isDeepRecall 
    ? "\n[DEEP RECALL MODE ACTIVE] 현재 여러 에피소드를 동시에 참조 중입니다. 최근 대화보다 제공된 과거 에피소드들의 설정과 인과관계를 최우선으로 반영하십시오."
    : "";

  return `
[명시적 에피소드 참조 데이터]
사용자가 과거 특정 화수의 전체 내용을 참고할 것을 요청했습니다. 아래 내용을 꼼꼼히 읽고 당시의 말투, 분위기, 세부 설정을 현재 서사에 반영하십시오.${deepRecallGuidance}
특히, 참조 데이터에 등장하는 사물의 외양, 상태, 적힌 문구, 물리적 훼손 정도 등 '객관적 사실 관계'는 절대 임의로 변경하거나 미화하지 마십시오. 
과거 내용에 매몰되지 말되, 설정의 일관성을 파괴하는 독자적인 창작은 엄격히 금지됩니다.

${content}
`;
};

/**
 * 최근 대화 내역 포맷팅 (Advisor용)
 */
export const formatRecentNarrative = (messages: Message[], limit: number = 5): string => {
  const recent = messages.filter(m => !m.isHidden).slice(-limit);
  return recent.map(m => `[${m.role === 'user' ? 'USER' : 'STORY'}] ${m.content}`).join('\n');
};
