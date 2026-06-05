
import { CompendiumEntry } from '../../../types/index';

/**
 * [Phase 2-D] Compendium Context Builder
 * 견문록 데이터를 AI 친화적인 텍스트로 변환합니다.
 */

export const buildCompendiumContext = (compendium?: CompendiumEntry[]): string => {
  if (!compendium || compendium.length === 0) return "";
  
  return `\n\n[대륙 견문록 (Compendium)]\n${compendium.map(entry => {
    let text = `### ${entry.title}\n`;
    entry.sections?.forEach(s => {
      if (s.subtitle) text += `#### ${s.subtitle}\n`;
      text += `${s.content}\n`;
    });
    return text;
  }).join('\n')}`;
};

export const buildExplicitCompendiumReference = (content: string | undefined): string => {
  if (!content) return "";
  
  return `
[명시적 견문록 참조 설정]
사용자가 특정 견문록 항목을 최우선적으로 참고할 것을 요청했습니다. 아래의 설정을 현재 서사에 깊이 있게 반영하십시오.
고유 명사, 역사적 배경, 세력 구도 등 견문록에 명시된 사실을 절대적으로 준수하며 서술하십시오.

${content}
`;
};
