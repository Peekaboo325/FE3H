// ─────────────────────────────────────────────────────────────────────────
//  앵커링 / 선택 주입 — 유저가 "N화 참고"라고 지목하면, 그 회차를 통째로 다시
//  넣지 않고 '목적'에 맞춰 요약·발췌·전문 중 하나로 추려(Flash) 주입한다.
//
//  v2에선 한 번 '전개' = 한 화(한 장면)이므로, N번째 서술자 본문 = N화로 센다.
//  legacy의 정규식(범위·다중 인식)을 계승하되, 주입은 한 단계 더 똑똑하게.
// ─────────────────────────────────────────────────────────────────────────

import { loadTurns, listLore, listCharacters } from './db.mjs';
import { pickAnchorBrief } from './summarize.mjs';
import { buildSummonedCharacters } from './charContext.mjs';

// 유저 입력에서 "N화 참고/참조"를 잡아 회차 번호 목록으로. (범위·다중 지원)
export function parseAnchors(text) {
  if (!text) return [];
  const nums = new Set();

  const range = text.match(/(\d+)\s*[~-]\s*(\d+)\s*화\s*(?:참고|참조)/);
  if (range) {
    const a = Number(range[1]);
    const b = Number(range[2]);
    for (let i = Math.min(a, b); i <= Math.max(a, b); i++) nums.add(i);
  } else {
    const multi = text.match(/((?:\d+[\s,]*)+)\s*화\s*(?:참고|참조)/);
    if (multi) {
      const ns = multi[1].match(/\d+/g);
      if (ns) ns.forEach((n) => nums.add(Number(n)));
    }
  }
  return [...nums].filter((n) => n > 0).sort((a, b) => a - b);
}

// 회차 번호들 → 그 화의 본문(유저 지시 + 서술자 본문) 추출.
function extractEpisodes(turns, episodeNums) {
  const want = new Set(episodeNums);
  const episodes = [];
  let count = 0; // 서술자 본문(=화) 카운터
  let pendingUser = null;
  for (const t of turns) {
    if (t.role === 'user') {
      pendingUser = t.content;
    } else if (t.role === 'assistant') {
      count += 1;
      if (want.has(count)) {
        const parts = [];
        if (pendingUser) parts.push(`[지시] ${pendingUser}`);
        parts.push(`[본문] ${t.content}`);
        episodes.push({ n: count, content: parts.join('\n') });
      }
      pendingUser = null;
    }
  }
  return episodes;
}

// 지목된 회차를 Flash로 추려, 시스템에 붙일 「참고 회차」 블록을 만든다.
// 반환: { block, episodes } — episodes는 '실제로 찾아 주입한' 회차 번호(확인 자취용).
// 회차가 없거나 Flash가 실패하면 block:null → 부르는 쪽은 그냥 앵커 없이 진행(안전).
export async function buildAnchorContext(storyId, userInput, episodeNums) {
  const 없음 = { block: null, episodes: [] };
  if (!storyId || !episodeNums?.length) return 없음;
  const { turns } = await loadTurns(storyId);
  if (!turns.length) return 없음;

  const episodes = extractEpisodes(turns, episodeNums);
  if (!episodes.length) return 없음;

  const brief = await pickAnchorBrief(userInput, episodes);
  if (!brief) return 없음; // 추려내기 실패 → 주입 안 됨 → 자취도 남기지 않음

  return {
    block:
      '# 참고 회차 (작가가 이번 화에 지목)\n' +
      '작가가 아래 회차를 참고하려 한다. 목적에 맞춰 추린 것이니 이번 본문에 자연스럽게 살려라.\n\n' +
      brief,
    episodes: episodes.map((e) => e.n),
  };
}

// ── 문헌(대륙 문헌) 앵커 ──────────────────────────────────────────────────
//  두 가지로 문헌을 지목한다(권 번호는 '그 영역 안에서의' 순번 = 화면 제N권과 일치):
//   ① 영역 + 권번호 — "왕국 제1권 참고" · "교단 1권 참조" · "만상 제2권"
//      (영역 토큰은 붙임·중점 모두 허용, '제' 생략 가능, '권'/'장' 받음.)
//   ② 제목 — "(더스커의 비극 참고)" (괄호). 같은 이름이 여럿이면 전부 되짚는다.
//  문헌은 짧고 정제돼 있어 Flash로 추리지 않고 그대로 주입한다('잠듦' 문헌 임시 소환에 쓸모).

// 다섯 영역(대륙 문헌 분류) — UI(Lore.tsx TOPICS)와 일치 유지.
const 영역들 = ['제국', '왕국', '동맹', '교단', '만상'];
const 무공백 = (s) => (s || '').replace(/[\s·]/g, '').toLowerCase();

function 느슨매칭(a, b) {
  const x = 무공백(a);
  const y = 무공백(b);
  return !!x && !!y && (x === y || x.includes(y) || y.includes(x));
}

// 영역 토큰(왕국/신성왕국 …) → 영역 제목. 못 찾으면 null.
function 영역찾기(token) {
  const t = 무공백(token);
  if (t.length < 2) return null;
  return 영역들.find((영역) => 느슨매칭(영역, t)) || null;
}

export function parseLoreAnchors(text) {
  if (!text) return { refs: [], titles: [] };
  let m;

  // ① 영역 + 권번호 — 토큰은 한글(중점 허용)·공백 없음, '제' 생략 가능, '권'/'장'.
  const refs = [];
  const seen = new Set();
  const refRe = /([가-힣]+(?:·[가-힣]+)?)\s*제?\s*(\d+)\s*(?:권|장)\s*(?:참고|참조)/g;
  while ((m = refRe.exec(text))) {
    const 영역 = 영역찾기(m[1]);
    const n = Number(m[2]);
    if (!영역 || n <= 0) continue;
    const key = 영역 + '#' + n;
    if (seen.has(key)) continue;
    seen.add(key);
    refs.push({ area: 영역, n });
  }

  // ② 제목 — 괄호 안.
  const titles = [];
  const titleRe = /\(([^)]+?)\s*(?:참고|참조)\)/g;
  while ((m = titleRe.exec(text))) {
    const t = m[1].trim();
    if (/^[가-힣]+(?:·[가-힣]+)?\s*제?\s*\d+\s*(?:권|장)$/.test(t)) continue; // 영역+번호는 ①에서
    if (/^제\s*\d+\s*(?:권|장)$/.test(t)) continue;
    if (/^\d+\s*화$/.test(t)) continue; // 회차 참조는 별개
    if (t) titles.push(t);
  }

  return { refs, titles };
}

// 반환: { block, items } — items는 '실제로 찾은' 문헌 [{ n: 권번호, t: 제목 }](확인 자취용).
export async function buildLoreAnchorContext(storyId, { refs, titles }) {
  const 없음 = { block: null, items: [] };
  if (!storyId || (!refs?.length && !titles?.length)) return 없음;
  const { lore } = await listLore(storyId); // sort_order, id 순
  if (!lore?.length) return 없음;

  // 영역 안에서의 순번(제N권) — 화면 제N권과 동일 기준.
  const 권번호 = (e) =>
    lore.filter((x) => x.category === e.category).findIndex((x) => x.id === e.id) + 1;

  const picked = new Map(); // id → entry (중복 제거)
  // ① 영역 + 권번호: 그 영역 안에서 n번째
  for (const { area, n } of refs) {
    const e = lore.filter((x) => x.category === area)[n - 1];
    if (e) picked.set(e.id, e);
  }
  // ② 제목: 같은 이름이 여럿이면 전부
  for (const title of titles) {
    for (const e of lore.filter((x) => 느슨매칭(x.title, title))) picked.set(e.id, e);
  }
  if (!picked.size) return 없음;

  const entries = [...picked.values()];
  const blocks = entries.map((e) => {
    const cat = e.category ? ` (${e.category})` : '';
    return `## ${e.title}${cat}\n${e.body || ''}`;
  });

  return {
    block:
      '# 참고 문헌 (작가가 지목)\n' +
      '작가가 아래 설정을 이번 화에 참고하려 한다. 본문에 반영하라.\n\n' +
      blocks.join('\n\n'),
    items: entries.map((e) => ({ n: 권번호(e), t: e.title })),
  };
}

// ── 인물 앵커 ──────────────────────────────────────────────────────────────
//  유저 입력에 "<퍼스트네임> 등장"이라 적으면, 그 인물을 이번 화만 소환해 약력을 주입한다.
//   · 퍼스트네임만으로 호출(디미트리 알렉산드르 블레다드 → "디미트리 등장").
//   · 이미 활성(상주)인 인물은 제외 — 중복 주입 방지.
//   · 캐시 경계 '뒤'에 주입(매 입력마다 달라짐) → 상주 인물·세계관 캐시를 안 깬다.
//  반환: { block, chars } — chars는 실제로 소환한 퍼스트네임(확인 자취용).
const 퍼스트 = (name) => (name ?? '').trim().split(/\s+/)[0] ?? '';
const 정규이스케이프 = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export async function buildCharacterAnchorContext(storyId, text) {
  const 없음 = { block: null, chars: [] };
  const t = String(text || '');
  if (!storyId || !t.includes('등장')) return 없음; // 빠른 컷(주문 없으면 DB 조회 생략)
  const { characters } = await listCharacters(storyId);
  if (!characters?.length) return 없음;

  const picked = [];
  for (const c of characters) {
    if (!c?.name || c.is_active !== false) continue; // 활성은 이미 상주 → 소환 불필요
    const fn = 퍼스트(c.name);
    if (!fn) continue;
    // "펠릭스 등장" / "펠릭스가 등장" / "펠릭스도 등장시켜" — 이름 뒤 조사(0~3자)+공백+등장.
    const re = new RegExp(정규이스케이프(fn) + '[가-힣]{0,3}\\s*등장');
    if (re.test(t) && !picked.includes(c)) picked.push(c);
  }
  if (!picked.length) return 없음;

  return { block: buildSummonedCharacters(picked), chars: picked.map((c) => 퍼스트(c.name)) };
}
