
import { CharacterProfile } from '../../../types/character';

/**
 * [Phase 2-D] Character Context Builder
 * 활성화된 유닛의 정보를 AI 친화적인 텍스트로 변환합니다.
 */
export const buildCharacterContext = (characters: CharacterProfile[]): string => {
  const activeChars = characters.filter(c => c.isActive !== false);
  if (activeChars.length === 0) return "활성화된 캐릭터 정보가 없습니다.";

  return `\n[활성화된 캐릭터 프로필]\n${activeChars.map(c => {
    const stats = c.analysis?.stats ? `(힘:${c.analysis.stats.prowess} 마:${c.analysis.stats.magic} 속:${c.analysis.stats.resilience} 방:${c.analysis.stats.status})` : '';
    return `- ${c.name} [${c.analysis?.title || '미상'}]: ${c.description} ${stats}`;
  }).join('\n')}`;
};

/**
 * 유닛 상태 요약 (Advisor용)
 */
export const buildUnitStatusSummary = (characters: any[]): string => {
  const activeChars = characters.filter(c => c.isActive !== false);
  return activeChars.map(c => {
    const specialty = c.specialty ? ` | 특기: ${c.specialty}` : '';
    return `- ${c.name} (${c.role || c.analysis?.title || '미상'})${specialty}`;
  }).join('\n');
};
