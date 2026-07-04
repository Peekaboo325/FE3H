// 일상(日常) 엔진 — 설계 docs/일상_설계.md. 자립 기둥(연료=프로필·세계·관계·정사, LLM 0).
//  0단계 = 빌더 세팅 저장. 1단계 = 능력 레이더(클라). 2단계 = '살아있는 지갑'(정산+시간당 수입, 여기).
//  능력 적립·활동 로그는 단계별로 여기에 붙는다. 저장은 analysis.daily 한 칸에 격리(보고서·약력 안 더럽힘).
import { getCharacter, setCharacterAnalysis } from './db.mjs';

// 시간당 고정 수입 — 신분 기준 가속형 1:10:50(설계 §7). 값은 동화(銅)/시. '없음'=0(벌이 끊긴 처지).
const 시간당수입 = { 없음: 0, 하: 5, 중: 50, 상: 250 };

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
  const 처음 = !prevDaily.setup_at;
  if (!daily.setup_at) daily.setup_at = new Date().toISOString(); // 첫 세팅 표식 — 일상 탭이 깃듦
  if (처음 && daily.wallet === undefined) daily.wallet = 0; // 지갑은 0에서 시작(열면서 차오름 §7)
  // 수입 시계 앵커 — 첫 확정 때, 그리고 수입 등급이 바뀔 때 '지금'으로 다시 심는다.
  //  (그래야 '없음' 구간이나 등급 변경 전 시간이 뒤늦게 적립되지 않는다 — 정산은 이 앵커 뒤부터 센다.)
  const 등급바뀜 = patch.income_grade !== undefined && patch.income_grade !== prevDaily.income_grade;
  if (처음 || 등급바뀜) daily.last_settled_at = new Date().toISOString();
  const merged = { ...(char.analysis || {}), daily };
  const save = await setCharacterAnalysis(characterId, merged);
  if (save.error) return { error: save.error };
  return { report: merged };
}

// 정산(§4 '열 때 정산') — 마지막 정산 뒤 흐른 시간 × 시간당 수입을 지갑에 적립한다. 순수 규칙(결정론·LLM 0).
//  트리거 = 일상 탭 열 때 '그 인물만'(전 인물 일괄 X — 이그레스 안전). 안 보는 동안 주머니가 차 있음.
//  1닢 미만(적립 못 한 나머지)은 이월 — last_settled_at을 '실제 적립한 만큼'만 전진시켜 자주 열어도 손실 없음.
//  변화가 없으면(적립 0) 저장을 생략한다(헛쓰기·egress 방지).
export async function 정산({ characterId } = {}) {
  if (!characterId) return { error: '지목이 없습니다.' };
  const char = await getCharacter(characterId);
  if (!char) return { error: '인물을 찾을 수 없습니다.' };
  const daily = char.analysis && typeof char.analysis.daily === 'object' ? char.analysis.daily : null;
  if (!daily || Array.isArray(daily) || !daily.setup_at) {
    return { report: char.analysis || {}, gained: 0 }; // 현황 전엔 정산 안 함
  }
  const rate = 시간당수입[daily.income_grade] ?? 0; // 동화/시
  const prevMs = daily.last_settled_at ? Date.parse(daily.last_settled_at) : NaN;
  const now = Date.now();

  // 앵커가 없으면(방어적) 지금으로 심어 다음 열람부터 적립되게 한다.
  if (Number.isNaN(prevMs)) {
    const merged = { ...(char.analysis || {}), daily: { ...daily, last_settled_at: new Date(now).toISOString() } };
    const save = await setCharacterAnalysis(characterId, merged);
    return save.error ? { error: save.error } : { report: merged, gained: 0 };
  }
  // 적립은 rate>0 & 시간이 흐른 경우만. 그 외(없음·시간 역행·1닢 미만)는 무변경(이월).
  if (rate <= 0 || now <= prevMs) return { report: char.analysis || {}, gained: 0 };
  const 시간 = (now - prevMs) / 3_600_000;
  const gained = Math.floor(시간 * rate);
  if (gained <= 0) return { report: char.analysis || {}, gained: 0 }; // 1닢도 안 참 — 이월(기준 유지)

  const wallet = (Number.isFinite(daily.wallet) ? daily.wallet : 0) + gained;
  const 소비ms = (gained / rate) * 3_600_000; // 적립한 만큼만 시각 전진(나머지 이월)
  const nextDaily = { ...daily, wallet, last_settled_at: new Date(prevMs + 소비ms).toISOString() };
  const merged = { ...(char.analysis || {}), daily: nextDaily };
  const save = await setCharacterAnalysis(characterId, merged);
  if (save.error) return { error: save.error };
  return { report: merged, gained };
}
