// ─────────────────────────────────────────────────────────────────────────
//  소지품 탐색소 — Gemini Flash가 인물의 주머니에서 물건 3점을 '찾아낸다'.
//
//  legacy(v1.0)의 인벤토리를 이식한 것(emoji 시스템 제외 — 텍스트 카드만).
//  핵심 설계는 그대로:
//   · 탐색할 때마다 기존 목록에 '누적'된다(갈아엎지 않음) — 주머니가 차는 수집 재미.
//   · 설명은 단정 금지 — 추론·감각·상태의 화법만(§1 '확정 사실이 아닌 각자의 시선').
//   · 영웅의 유물·게임 전용 보구 금지(시대 방화벽).
//  프롬프트는 v2.0 결(규칙·금지 중심)로 새로 썼다.
//
//  저장 = characters.analysis(jsonb) 안의 belongings 칸 — 스키마 변경 없음.
//  고유명사 '표기 목록'(NAMES) 주입은 임무와 같은 §3 승인 예외.
// ─────────────────────────────────────────────────────────────────────────

import { getCharacter, setCharacterAnalysis } from './db.mjs';
import { callGeminiJSON, 약력문, 맥락모으기 } from './report.mjs';
import { NAMES } from './worldview.mjs';

const 탐색수 = 3; // 한 번 탐색에 찾아내는 물건 수

// 소지품 탐색 프롬프트(한국어 출력). 약력·맥락·기존 목록을 읽고 JSON으로.
export function buildItemsPrompt(char, { context, existing = [] } = {}) {
  return `너는 포드라의 '왕실 분석관'이다. 인물 "${char.name}"의 소지품을 탐색해 정확히 ${탐색수}점을 새로 기록하라.
출력은 모두 자연스러운 한국어(올바른 띄어쓰기·문법)로 쓴다.

[약력]
${약력문(char)}
(중요: 게임 원작 설정보다 위 커스텀 약력을 우선한다.)

[최근 맥락]
${context || '(아직 쌓인 본문이 없다 — 약력과 설정에 충실하게 찾아낸다.)'}

${existing.length ? `[이미 기록된 소지품]\n${existing.map((b) => `- ${b.name}`).join('\n')}\n(위와 같거나 비슷한 물건은 금지 — 인물의 서사를 넓히는 다른 결의 물건을 찾는다.)\n` : ''}
[소지품 규칙]
- 시대 방화벽: 영웅의 유물·성무기(천제의 검·아랏드바르·루인·페일노트 등)와 게임 전용 보구는 절대 금지 — 그건 서사의 장치지 주머니 속 물건이 아니다.
- name(이름): 한국어 명사구, 15자 이내.
- comment(설명): 25자 이내의 한 문장. 화법은 셋 중 하나만 — 추론(~인 것 같다·~듯하다), 감각(~향이 난다·~느껴진다), 상태(~묻어 있다·~상태). 출처와 내력을 단정하지 말 것 — 누구의 선물인지, 어디서 산 것인지는 적지 않는다. 점 두 개(..) 금지.
- ${탐색수}점 중 1점쯤엔 아래 [고유명사 표기]의 문화·기후·세력의 결을 녹인다 — 지명을 기계적으로 붙이지 말고 풍미로.
- 인물의 처지·최근 사건이 묻어나는 물건을 우선하되, 시시한 일상 소지품도 섞어 사람 냄새를 남긴다.

[고유명사 표기]
${NAMES.join(', ')}

[출력 JSON 구조] — 아래 키를 그대로, 설명·머리말 없이 JSON만:
{ "belongings": [ { "name": "물건 이름", "comment": "한 줄 설명" } ] }`;
}

// LLM 출력의 들쭉날쭉함을 다듬고, 소각·식별용 안정 id를 단다.
function normalizeItems(d) {
  const 정리 = (s) => String(s ?? '').replace(/[[\]【】]/g, '').replace(/\s{2,}/g, ' ').trim();
  const arr = Array.isArray(d?.belongings) ? d.belongings : [];
  const base = Date.now().toString(36);
  return arr
    .map((b, i) => ({ id: `i${base}${i}`, name: 정리(b?.name), comment: 정리(b?.comment) }))
    .filter((b) => b.name)
    .slice(0, 탐색수);
}

// 탐색 오케스트레이터 — 새 물건을 찾아 기존 belongings 뒤에 누적하고 저장한다.
export async function runItems({ characterId, storyId } = {}) {
  if (!characterId) return { error: '인물 지목이 없습니다.' };
  const char = await getCharacter(characterId);
  if (!char) return { error: '인물을 찾을 수 없습니다.' };

  const existing = Array.isArray(char.analysis?.belongings) ? char.analysis.belongings : [];
  const sid = storyId || char.story_id || null;
  const context = await 맥락모으기(sid);

  const prompt = buildItemsPrompt(char, { context, existing });
  const { data, error } = await callGeminiJSON(prompt, {
    temperature: 0.9,
    maxOutputTokens: 2000,
    thinkingBudget: 512,
    tag: '소지품',
  });
  if (error) return { error };

  const found = normalizeItems(data);
  if (!found.length) return { error: '물건을 한 점도 찾지 못했습니다 — 다시 시도하십시오.' };

  const merged = {
    ...(char.analysis || {}),
    belongings: [...existing, ...found],
    belongings_at: new Date().toISOString(),
  };
  const save = await setCharacterAnalysis(characterId, merged);
  if (save.error) return { error: save.error };
  return { report: merged };
}

// 소각 — 물건 하나를 목록에서 들어낸다(id 기준).
export async function removeItem({ characterId, itemId } = {}) {
  if (!characterId || !itemId) return { error: '지목이 없습니다.' };
  const char = await getCharacter(characterId);
  if (!char) return { error: '인물을 찾을 수 없습니다.' };
  const existing = Array.isArray(char.analysis?.belongings) ? char.analysis.belongings : [];
  const next = existing.filter((b) => b?.id !== itemId);
  if (next.length === existing.length) return { error: '그 물건을 찾을 수 없습니다.' };
  const merged = { ...(char.analysis || {}), belongings: next };
  const save = await setCharacterAnalysis(characterId, merged);
  if (save.error) return { error: save.error };
  return { report: merged };
}
