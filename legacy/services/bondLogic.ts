
import { BondTheme } from '../types/character';

/**
 * [Semantic Emotion Engine v2.5]
 * 인연의 '껍데기(카테고리)'와 '알맹이(내용)'을 교차 분석하여 시각적 테마를 결정합니다.
 * v2.5 Update: 가족 관계 키워드 대폭 확장 (모친, 부친, 조력자 등)
 */

const VIOLET_KEYWORDS = ['배신', '증오', '주범', '암살', '적대', '원수', '복수', '처단', '경계', '의심', '숙적', '정적', '대립'];
const ROSE_KEYWORDS = ['사랑', '연모', '짝사랑', '반려', '연인', '애정', '심쿵', '설렘'];
const SLATE_KEYWORDS = ['소원', '냉랭', '무관심', '지인', '타인', '어색'];

// 가족 및 깊은 신뢰 관계 키워드 보강
const CRIMSON_KEYWORDS = ['가족', '부모', '자식', '모친', '부친', '모자', '부녀', '형제', '자매', '보호자', '후원자', '스승', '교관', '선생님'];

export const getBondTheme = (category: string, description: string): BondTheme => {
  const content = description + category;

  // 1. Contextual Override (Negative Priority - Absolute First)
  if (VIOLET_KEYWORDS.some(k => content.includes(k))) return 'violet';
  
  // 2. Secret Love Override
  if (ROSE_KEYWORDS.some(k => content.includes(k))) return 'rose';

  // 3. Family/Guardian Override
  if (CRIMSON_KEYWORDS.some(k => content.includes(k))) return 'crimson';

  // 4. Low Temperature Override
  if (SLATE_KEYWORDS.some(k => content.includes(k))) return 'slate';

  // 5. Default Category Mapping
  if (category.includes('가족') || category.includes('형제') || category.includes('자매') || category.includes('부모') || category.includes('자식') || category.includes('모친') || category.includes('부친')) return 'crimson';
  if (category.includes('연인') || category.includes('부부') || category.includes('정인')) return 'rose';
  if (category.includes('친구') || category.includes('소꿉친구') || category.includes('동료') || category.includes('전우') || category.includes('벗')) return 'emerald';
  if (category.includes('주군') || category.includes('충성') || category.includes('기사') || category.includes('폐하') || category.includes('전하')) return 'azure';
  if (category.includes('계약') || category.includes('협력') || category.includes('이해') || category.includes('책사')) return 'amber';

  return 'slate'; // Default
};

export const getThemeStyles = (theme: BondTheme) => {
  const map = {
    rose: { border: 'border-pink-500', bg: 'bg-pink-500/10', text: 'text-pink-500' },
    crimson: { border: 'border-[#dc2626]', bg: 'bg-[#dc26260d]', text: 'text-[#dc2626]' },
    emerald: { border: 'border-[#10b981]', bg: 'bg-[#10b9810d]', text: 'text-[#10b981]' },
    azure: { border: 'border-[#3b82f6]', bg: 'bg-[#3b82f60d]', text: 'text-[#3b82f6]' },
    violet: { border: 'border-[#8b5cf6]', bg: 'bg-[#8b5cf60d]', text: 'text-[#8b5cf6]' },
    amber: { border: 'border-[#f59e0b]', bg: 'bg-[#f59e0b0d]', text: 'text-[#f59e0b]' },
    slate: { border: 'border-[#64748b]', bg: 'bg-[#64748b0d]', text: 'text-[#64748b]' },
  };
  return map[theme];
};
