// 일상(日常) 엔진 — 설계 docs/일상_설계.md. 자립 기둥(연료=프로필·세계·관계·정사, LLM 0).
//  0단계 = 빌더 세팅 저장만. 능력 적립·경제 정산·활동 로그는 단계별로 여기에 붙는다.
//  저장은 analysis.daily 한 칸에 격리(보고서·약력 안 더럽힘). 임무·소지품과 동형(순수 DB).
import { getCharacter, setCharacterAnalysis } from './db.mjs';

// 일상 세팅 저장 — 빌더가 일상 탭 안에서 깐 시작 등급·특성·수입 등을 daily 서랍에 새긴다(피플 생성하듯).
//  patch = daily의 부분 패치({ start_grades?, traits?, income_grade? } 등). 처음 저장 때 setup_at이 박혀
//  '일상이 깃든다'(자기칸 가림 판정 §14). AI 안 거침 — 빌더 수기, 정확도 100%·비용 0.
export async function saveDaily({ characterId, patch } = {}) {
  if (!characterId) return { error: '지목이 없습니다.' };
  if (!patch || typeof patch !== 'object' || Array.isArray(patch)) return { error: '세팅 내용이 비었습니다.' };
  const char = await getCharacter(characterId);
  if (!char) return { error: '인물을 찾을 수 없습니다.' };
  const prevDaily =
    char.analysis && typeof char.analysis.daily === 'object' && char.analysis.daily ? char.analysis.daily : {};
  const daily = { ...prevDaily, ...patch };
  if (!daily.setup_at) daily.setup_at = new Date().toISOString(); // 첫 세팅 표식 — 일상 탭이 깃듦
  const merged = { ...(char.analysis || {}), daily };
  const save = await setCharacterAnalysis(characterId, merged);
  if (save.error) return { error: save.error };
  return { report: merged };
}
