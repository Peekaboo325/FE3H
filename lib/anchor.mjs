// ─────────────────────────────────────────────────────────────────────────
//  앵커링 / 선택 주입 — 유저가 "N화 참고"라고 지목하면, 그 회차를 통째로 다시
//  넣지 않고 '목적'에 맞춰 요약·발췌·전문 중 하나로 추려(Flash) 주입한다.
//
//  v2에선 한 번 '전개' = 한 화(한 장면)이므로, N번째 서술자 본문 = N화로 센다.
//  legacy의 정규식(범위·다중 인식)을 계승하되, 주입은 한 단계 더 똑똑하게.
// ─────────────────────────────────────────────────────────────────────────

import { loadTurns, listLore } from './db.mjs';
import { pickAnchorBrief } from './summarize.mjs';

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
// 회차가 없거나 Flash가 실패하면 null → 부르는 쪽은 그냥 앵커 없이 진행(안전).
export async function buildAnchorContext(storyId, userInput, episodeNums) {
  if (!storyId || !episodeNums?.length) return null;
  const { turns } = await loadTurns(storyId);
  if (!turns.length) return null;

  const episodes = extractEpisodes(turns, episodeNums);
  if (!episodes.length) return null;

  const brief = await pickAnchorBrief(userInput, episodes);
  if (!brief) return null;

  return (
    '# 참고 회차 (작가가 이번 화에 지목)\n' +
    '작가가 아래 회차를 참고하려 한다. 목적에 맞춰 추린 것이니 이번 본문에 자연스럽게 살려라.\n\n' +
    brief
  );
}

// ── 견문록 앵커 ──────────────────────────────────────────────────────────
//  "제N장 참조" (장 번호) 또는 "(제목 참조)" (괄호 안 제목)로 견문록을 지목한다.
//  견문록은 짧고 정제돼 있어 Flash로 추리지 않고 그 항목을 그대로 주입한다.
//  (특히 '잠듦' 견문록을 그때만 되살리는 데 쓸모.)

function 느슨매칭(a, b) {
  const n = (s) => (s || '').replace(/\s+/g, '').toLowerCase();
  const x = n(a);
  const y = n(b);
  return !!x && !!y && (x === y || x.includes(y) || y.includes(x));
}

export function parseLoreAnchors(text) {
  if (!text) return { numbers: [], titles: [] };
  const numbers = new Set();
  let m;

  const numRe = /제\s*(\d+)\s*장\s*(?:참고|참조)/g;
  while ((m = numRe.exec(text))) numbers.add(Number(m[1]));

  const titles = [];
  const titleRe = /\(([^)]+?)\s*(?:참고|참조)\)/g;
  while ((m = titleRe.exec(text))) {
    const t = m[1].trim();
    if (/^제\s*\d+\s*장$/.test(t)) continue; // 장 번호 참조는 위에서 처리됨
    if (/^\d+\s*화$/.test(t)) continue; // 회차 참조는 별개
    if (t) titles.push(t);
  }

  return {
    numbers: [...numbers].filter((n) => n > 0).sort((a, b) => a - b),
    titles,
  };
}

export async function buildLoreAnchorContext(storyId, { numbers, titles }) {
  if (!storyId || (!numbers.length && !titles.length)) return null;
  const { lore } = await listLore(storyId); // sort_order, id 순 = 제N장
  if (!lore?.length) return null;

  const picked = new Map(); // id → entry (중복 제거)
  for (const n of numbers) {
    const e = lore[n - 1];
    if (e) picked.set(e.id, e);
  }
  for (const title of titles) {
    const e = lore.find((x) => 느슨매칭(x.title, title));
    if (e) picked.set(e.id, e);
  }
  if (!picked.size) return null;

  const blocks = [...picked.values()].map((e) => {
    const 장 = lore.findIndex((x) => x.id === e.id) + 1;
    const cat = e.category ? ` (${e.category})` : '';
    return `## 제${장}장 · ${e.title}${cat}\n${e.body || ''}`;
  });

  return (
    '# 참고 견문록 (작가가 지목)\n' +
    '작가가 아래 설정을 이번 화에 참고하려 한다. 본문에 반영하라.\n\n' +
    blocks.join('\n\n')
  );
}
