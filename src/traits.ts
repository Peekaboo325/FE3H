// 특성(特性) 사전 — 일상(日常)의 인물 기질 카탈로그. 빌더가 인물마다 골라 붙인다(현황 설정 면).
//  설계 docs/일상_설계.md §6. 개별 효과(효율 ±·상한·상극)는 4단계(육성)에서 확정 — 여기선 '등록·표기'만.
//  ⚠️ 이 목록은 늘기만 한다(줄지 않음). 늘면 '믹스'(여러 능력에 걸친 복합 특성)가 붙을 수 있으니,
//     그때는 ability를 배열로 넓히거나 group:'믹스' 묶음을 더한다(지금은 단일 능력만).
import type { AbilityKey } from './useCharacters';

export type TraitDef = {
  name: string; // 표기(=저장 키). 이 이름 그대로 daily.traits에 박힌다.
  ability: AbilityKey; // 매인 능력(이 능력 결의 기질). 믹스가 생기면 이 자리를 넓힌다.
};

// 능력별로 묶어 둔다(현황 설정 면이 이 순서대로 능력 묶음을 그린다).
export const TRAITS: TraitDef[] = [
  { name: '무골', ability: 'prowess' },
  { name: '무둔', ability: 'prowess' },
  { name: '마도친화', ability: 'magic' },
  { name: '마도불응', ability: 'magic' },
  { name: '경건', ability: 'faith' },
  { name: '불신', ability: 'faith' },
  { name: '광신', ability: 'faith' },
  { name: '총명', ability: 'intellect' },
  { name: '산만', ability: 'intellect' },
  { name: '흡인', ability: 'charm' },
  { name: '반발', ability: 'charm' },
  { name: '강심', ability: 'resilience' },
  { name: '심흔', ability: 'resilience' },
];

// 이름 → 정의 빠른 조회(저장된 특성의 능력 결을 되찾을 때).
export const TRAIT_BY_NAME: Record<string, TraitDef> = Object.fromEntries(TRAITS.map((t) => [t.name, t]));
