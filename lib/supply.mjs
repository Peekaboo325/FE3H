// ─────────────────────────────────────────────────────────────────────────
//  물자 조달 — 저잣거리 점포에서 Gemini Flash가 '입하'한 물건을 인물 소지품에 '조달'한다.
//
//  설계 = docs/물자조달_설계.md. 순수 재미(수집·선물)·본문 비연동·게임화(숫자) 회피.
//  소지품 탐색(items.mjs)을 *분류 한정 + 상점 말투 + 인물·맥락 제거*로 변주한 것.
//   · 점포 6 = 분류 묶음(SHOPS). 입하 = 그 분류에서만 9점 생성(Flash 1콜).
//   · 재고는 이야기별 지속(settings 표 supply:{storyId}) — '새로 입하'로만 교체, 조달하면 소진.
//   · 조달 = 재고 한 점을 인물 analysis.belongings에 append + 재고서 제거(콜 없음·DB만).
//  ⚠️ Gemini에 SYSTEM·NAMES 안 넣음(§3 예외 불필요 — 물건은 일반명사). 물질문화 금지 몇 줄만.
// ─────────────────────────────────────────────────────────────────────────

import { getCharacter, setCharacterAnalysis, getSupply, setSupply } from './db.mjs';
import { callGeminiJSON } from './report.mjs';
import { ITEM_ICON_GROUPS, ICON_BY_LABEL, ICON_KEYS, ICON_ALIASES } from './itemIcons.mjs';

const 입하수 = 9; // 한 번 입하에 진열되는 점수(빌더 결정)

// 점포 6 — key·label·끌어 쓰는 분류(ITEM_ICON_GROUPS.cat과 정확히 일치해야 함). 512종 빠짐없이 덮음.
export const SHOPS = [
  { key: 'grocery', label: '식료품점', cats: ['음식·식재료'] },
  { key: 'general', label: '잡화점', cats: ['생활·도구', '문서·기록'] },
  { key: 'attire', label: '의상실', cats: ['의복·천', '장신구·기념품'] },
  { key: 'smithy', label: '대장간', cats: ['무기·군용품'] },
  { key: 'forager', label: '채집상', cats: ['약초·꽃', '자연물'] },
  { key: 'blackmarket', label: '암시장', cats: ['종교·주술물', '증표·불명물', '마물 소재'] },
];

// 그 점포가 다루는 분류의 그림 라벨만 묶어 후보로(소지품 [그림 후보]의 점포 한정판).
function 점포라벨(shop) {
  return ITEM_ICON_GROUPS.filter((g) => shop.cats.includes(g.cat))
    .map((g) => `【${g.cat}】 ${g.items.map((i) => i.label).join(', ')}`)
    .join('\n');
}

// 입하 프롬프트(한국어 출력). 점포 한 곳의 신상 9점을 JSON으로. 인물·맥락 없음(freeform).
export function buildRestockPrompt(shop) {
  return `너는 포드라 저잣거리 '${shop.label}'의 진열을 채우는 상인이다. 오늘 막 들어온 신상 ${입하수}점을 진열하라.
출력은 모두 자연스러운 한국어(올바른 띄어쓰기·문법)로 쓴다. '${shop.label}'이(가) 다룰 만한 물건만 — 다른 가게 것은 금지(아래 [그림 후보]가 이 가게가 다루는 갈래다).

[규칙]
- name(이름): 한국어 명사구 15자 이내. 구체적이고 탐나게 — 막연한 '물건'이 아니라 '겉이 노릇한 보리빵'·'날이 시퍼런 단검'처럼.
- comment(설명): 한 문장(최대 25자). 그 물건의 상태·질감·산지·먹음새 같은 '상점 풍미' 하나만. 손님을 끌 한마디. 점 두 개(..) 금지.
- ⚠️ 문구는 매번 새롭게(중요): '갓 ~한, ~한 냄새가 난다' 같은 한 틀을 ${입하수}점에 반복하지 마라. 아홉 문구는 짜임새·말맛이 저마다 달라야 한다.
- 다양성: ${입하수}점은 서로 재질·형태·쓰임이 겹치지 않게 — 저마다 다른 갈래. 'A→조금 다른 A'(돌→조약돌→자갈) 변주로 자리 채우지 말 것.
- 시대 방화벽: 영웅의 유물·성무기·게임 전용 보구 금지. 평범한 저잣거리 물건만.
- 물질문화는 서양 중세 — 붓·먹·벼루 같은 동양 문방구가 아니라 깃펜·잉크병으로. 게임 용어(레벨·스킬 등)·여신 외 다른 신 금지.
- icon: 아래 [그림 후보]에서 그 물건에 가장 가까운 라벨 하나를 골라 그대로 적는다(목록 밖 단어 금지). ① 분류 먼저 → ② 그 안에서 이름·재질·용도가 가장 구체적으로 맞는 라벨.

[그림 후보 — 이 가게가 다루는 것만]
${점포라벨(shop)}

[출력 JSON 구조] — 설명·머리말 없이 JSON만:
{ "stock": [ { "name": "물건 이름", "comment": "한 줄", "icon": "그림 후보 중 하나" } ] }`;
}

// 안정 id(조달·소각·식별용). 소지품과 같은 결.
const 새id = () => `i${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
const 이름키 = (s) => String(s || '').replace(/\s+/g, '').toLowerCase();

// LLM 출력을 다듬고 아이콘 라벨을 보유 key로 환원한다(소지품 normalizeItems와 같은 결).
function normalizeStock(d) {
  const 정리 = (s) => String(s ?? '').replace(/[[\]【】]/g, '').replace(/\s{2,}/g, ' ').trim();
  const 아이콘키 = (raw, 물건이름) => {
    const t = 정리(raw);
    if (!t) return undefined;
    if (ICON_BY_LABEL.has(t)) return ICON_BY_LABEL.get(t);
    if (ICON_KEYS.has(t)) return t;
    if (ICON_ALIASES.has(t)) return ICON_ALIASES.get(t);
    console.warn(`[물자] 분실물 대장 — 그림 매칭 실패: "${t}" (물건: ${물건이름 || '?'})`);
    return undefined;
  };
  const arr = Array.isArray(d?.stock) ? d.stock : [];
  return arr
    .map((b) => ({ id: 새id(), name: 정리(b?.name), comment: 정리(b?.comment), icon: 아이콘키(b?.icon, 정리(b?.name)) }))
    .filter((b) => b.name);
}

// 입하 — 점포 한 곳의 재고를 새 9점으로 교체(기존은 버림). 같은 물건 재등장은 허용, 단 한 묶음 안은 비중복.
export async function runRestock({ storyId, shop: shopKey } = {}) {
  const shop = SHOPS.find((s) => s.key === shopKey);
  if (!shop) return { error: '그런 점포가 없습니다.' };

  const { data, error } = await callGeminiJSON(buildRestockPrompt(shop), {
    temperature: 0.95,
    maxOutputTokens: 2500,
    thinkingBudget: 512,
    tag: '입하',
  });
  if (error) return { error };

  // 한 묶음 안 이름 중복만 떨군다(상점은 재입고가 자연 — 과거 재고와의 중복은 막지 않음).
  const seen = new Set();
  const stock = [];
  for (const it of normalizeStock(data)) {
    const k = 이름키(it.name);
    if (!k || seen.has(k)) continue;
    seen.add(k);
    stock.push(it);
    if (stock.length >= 입하수) break;
  }
  if (!stock.length) return { error: '입하된 물건이 없습니다 — 다시 시도하십시오.' };

  const supply = await getSupply(storyId);
  supply[shopKey] = stock;
  const save = await setSupply(storyId, supply);
  if (save.error) return { error: save.error };
  return { stock };
}

// 조달 — 재고 한 점을 인물 소지품에 옮긴다(belongings append + 재고서 제거). 콜 없음.
export async function procureItem({ storyId, shop: shopKey, itemId, characterId } = {}) {
  if (!shopKey || !itemId || !characterId) return { error: '지목이 없습니다.' };
  const supply = await getSupply(storyId);
  const stock = Array.isArray(supply[shopKey]) ? supply[shopKey] : [];
  const item = stock.find((i) => i?.id === itemId);
  if (!item) return { error: '그 물건을 찾을 수 없습니다.' };

  const char = await getCharacter(characterId);
  if (!char) return { error: '인물을 찾을 수 없습니다.' };

  // 소지품에 append(점포 풍미 한 줄 그대로, 새 id). AI 탐색물과 한 주머니에 섞인다(의도).
  const belongings = Array.isArray(char.analysis?.belongings) ? char.analysis.belongings : [];
  const 새물건 = { id: 새id(), name: item.name, comment: item.comment, icon: item.icon };
  const mergedChar = {
    ...(char.analysis || {}),
    belongings: [...belongings, 새물건],
    belongings_at: new Date().toISOString(),
  };
  const save = await setCharacterAnalysis(characterId, mergedChar);
  if (save.error) return { error: save.error };

  // 재고서 제거(소진).
  supply[shopKey] = stock.filter((i) => i?.id !== itemId);
  await setSupply(storyId, supply);
  return { stock: supply[shopKey], report: mergedChar };
}
