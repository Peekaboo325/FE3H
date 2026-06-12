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
import { ITEM_ICON_GROUPS, ICON_BY_LABEL, ICON_KEYS, ICON_ALIASES } from './itemIcons.mjs';

const 탐색수 = 3; // 한 번 탐색에 찾아내는 물건 수
// 그림 후보 — 평평한 나열 대신 분류 머리글로 묶음(명단이 커질수록 '비슷한 것 중 아무거나' 노이즈 방지).
const 그림라벨 = ITEM_ICON_GROUPS.map(
  (g) => `【${g.cat}】 ${g.items.map((i) => i.label).join(', ')}`,
).join('\n');

// 소지품 탐색 프롬프트(한국어 출력). 약력·맥락·기존 목록을 읽고 JSON으로.
export function buildItemsPrompt(char, { context, existing = [] } = {}) {
  return `너는 포드라의 '왕실 분석관'이다. 인물 "${char.name}"의 소지품을 탐색해 정확히 ${탐색수}점을 새로 기록하라.
출력은 모두 자연스러운 한국어(올바른 띄어쓰기·문법)로 쓴다.

[약력]
${약력문(char)}
(중요: 게임 원작 설정보다 위 커스텀 약력을 우선한다.)

[최근 맥락]
${context || '(아직 쌓인 본문이 없다 — 약력과 설정에 충실하게 찾아낸다.)'}

${existing.length ? `[이미 기록된 소지품 — ${existing.length}점]\n${existing.map((b) => `- ${b.name}`).join('\n')}\n(절대 규칙: 위와 이름이 같거나, 재질·형태·쓰임이 겹치거나, 결이 닮은 물건은 금지. 같은 부류를 말만 바꾼 변주(예: 돌→조약돌→자갈→돌멩이, 들꽃→꽃잎→마른 꽃, 깃털→솜털)도 전부 금지 — 매번 분명히 다른 갈래를 연다.)\n` : ''}
[소지품 규칙]
- 시대 방화벽: 영웅의 유물·성무기(천제의 검·아랏드바르·루인·페일노트 등)와 게임 전용 보구는 절대 금지 — 그건 서사의 장치지 주머니 속 물건이 아니다.
- name(이름): 한국어 명사구, 15자 이내.
- comment(설명): 25자 이내의 한 문장. 지금 눈앞 물건의 상태·흔적·질감·분위기만 그린다. 화법은 추론(~인 것 같다·~듯하다)·감각(~느껴진다)·상태(~묻어 있다) 중 하나. 점 두 개(..) 금지.
- 보여주되 말하지 않는다(가장 중요): 설명의 주어는 늘 '물건'이다 — 주인이 무엇을 했는지(행위)·느꼈는지(심정)·어떤 사람인지가 아니라, 물건이 어떤 상태인지로만 문장을 맺는다. 주인의 성격·과거·동기, 물건의 출처·내력은 지어내지 않는다. 인물의 결은 물건의 상태로 은근히 배어 나오게 두고 읽는 이가 미루어 느끼게 한다 — 결론을 대신 적지 않는다. '~듯하다'를 붙여도 주인의 행위·심중·사연을 끌어들이면 위반이다.
- 다양성(중요): 이번 ${탐색수}점은 서로 재질·형태·쓰임이 겹치지 않게 — 셋이 저마다 다른 갈래여야 한다. '흙 묻은 돌·조약돌·자갈', '말라붙은 꽃·들꽃·꽃잎' 같은 의미 없는 자연 파편으로 자리를 채우지 말고, 인물의 삶·손때가 묻은 구체적인 물건을 우선한다(연장·문서·장신구·의복·생활도구 등 갈래를 고루).
- ${탐색수}점 중 1점쯤엔 아래 [고유명사 표기]의 문화·기후·세력의 결을 녹인다 — 지명을 기계적으로 붙이지 말고 풍미로.
- 인물의 삶이 자연스레 드러나는 물건을 우선하되, 그 삶을 설명문으로 풀어 쓰지 않는다. 시시한 일상 소지품도 섞어 사람 냄새를 남긴다.
- icon: 아래 [그림 후보]는 '이미 지은 물건에 그림을 매칭'할 때만 쓴다. 목록에 어떤 단어가 있다는 이유로 그 물건을 짓지 말 것 — 물건은 오직 약력·맥락에서 길어 올린다. (예: 목록에 음식이 많다고 음식을 자주 만들지 말 것.) 매칭 순서: ① 물건이 속한 【분류】를 먼저 정하고 ② 그 분류 안에서 이름·재질·용도가 '가장 구체적으로' 일치하는 라벨 하나를 골라 그대로 적는다. 비슷한 라벨이 여럿이면(잔·병·모자·드레스류) 물건 묘사에 제일 가까운 세부 라벨로. 꼭 들어맞지 않아도 가장 가까운 것으로(딱 맞는 게 없으면 가장 근접한 갈래로). 목록에 없는 단어는 쓰지 말 것.

[그림 후보]
${그림라벨}

[고유명사 표기]
${NAMES.join(', ')}

[출력 JSON 구조] — 아래 키를 그대로, 설명·머리말 없이 JSON만:
{ "belongings": [ { "name": "물건 이름", "comment": "한 줄 설명", "icon": "그림 후보 중 하나" } ] }`;
}

// LLM 출력의 들쭉날쭉함을 다듬고, 소각·식별용 안정 id를 단다.
//  icon: AI가 고른 그림 라벨(또는 키·별칭)을 보유 명단의 key로 환원. 못 맞추면 폴백 +
//  '분실물 대장' 로그를 남긴다(어떤 표기 변형이 새는지 보고 ICON_ALIASES에 보태는 재료).
function normalizeItems(d) {
  const 정리 = (s) => String(s ?? '').replace(/[[\]【】]/g, '').replace(/\s{2,}/g, ' ').trim();
  const 아이콘키 = (raw, 물건이름) => {
    const t = 정리(raw);
    if (!t) return undefined;
    if (ICON_BY_LABEL.has(t)) return ICON_BY_LABEL.get(t); // 라벨로 골랐으면 key로
    if (ICON_KEYS.has(t)) return t; // 혹시 key를 그대로 뱉었으면 그대로
    if (ICON_ALIASES.has(t)) return ICON_ALIASES.get(t); // 동의어 흡수
    console.warn(`[소지품] 분실물 대장 — 그림 매칭 실패: "${t}" (물건: ${물건이름 || '?'})`);
    return undefined; // 명단 밖 → 폴백
  };
  const arr = Array.isArray(d?.belongings) ? d.belongings : [];
  // id는 충돌 불가능해야 한다(React key·정렬·소각 기준) — 시각+무작위로 같은 ms 탐색에도 안 겹치게.
  const 새id = () => `i${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
  return arr
    .map((b) => ({ id: 새id(), name: 정리(b?.name), comment: 정리(b?.comment), icon: 아이콘키(b?.icon, 정리(b?.name)) }))
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

  // 중복 완화(결정적) — 프롬프트만으론 새던 '정확한 이름 중복'을 코드가 떨군다.
  //  기존 목록 + 이번 묶음 안에서 이름이 겹치면 제외(공백·대소문자 무시). 근접·테마 중복은 프롬프트가 맡음.
  const 이름키 = (s) => String(s || '').replace(/\s+/g, '').toLowerCase();
  const 본것 = new Set(existing.map((b) => 이름키(b?.name)));
  const 새물건 = [];
  for (const b of found) {
    const k = 이름키(b.name);
    if (!k || 본것.has(k)) continue;
    본것.add(k);
    새물건.push(b);
  }
  if (!새물건.length) return { error: '새로운 물건을 찾지 못했습니다 — 다시 시도하십시오.' };

  const merged = {
    ...(char.analysis || {}),
    belongings: [...existing, ...새물건],
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

// 정렬 — 드래그로 바뀐 순서(id 배열)대로 다시 늘어놓는다. 빠진 물건은 뒤에 보존.
export async function reorderItems({ characterId, order } = {}) {
  if (!characterId || !Array.isArray(order) || !order.length) return { error: '지목이 없습니다.' };
  const char = await getCharacter(characterId);
  if (!char) return { error: '인물을 찾을 수 없습니다.' };
  const existing = Array.isArray(char.analysis?.belongings) ? char.analysis.belongings : [];
  const byId = new Map(existing.filter((b) => b?.id).map((b) => [b.id, b]));
  const next = order.map((id) => byId.get(id)).filter(Boolean);
  for (const b of existing) if (!b?.id || !order.includes(b.id)) next.push(b);
  const merged = { ...(char.analysis || {}), belongings: next };
  const save = await setCharacterAnalysis(characterId, merged);
  if (save.error) return { error: save.error };
  return { report: merged };
}
