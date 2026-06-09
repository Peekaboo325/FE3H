// ─────────────────────────────────────────────────────────────────────────
//  연대 문헌 — 화별 요약(왕실 사관의 기록).
//
//  화별 요약 하나가 두 곳에 쓰인다(단일 진실):
//   · 연대 문헌(유저가 읽는 화별 줄거리)
//   · 컨텍스트 윈도우(옛 화는 이 요약으로 클로드에 주입 → 토큰 절감)
//
//  제목은 새로 짓지 않는다 — 본문에 이미 있는 회차 제목(예: "제1화 · 첫눈")을 따온다.
// ─────────────────────────────────────────────────────────────────────────

import { setTurnSummary, loadCharactersForInjection, getStoryMemory } from './db.mjs';
import { summarizeEpisode } from './summarize.mjs';

// 요약기에 줄 '맥락' — 이 이야기 등장인물 명단(이름+이명) + 지금까지 큰 줄기.
//  본문이 인물을 막연한 호칭으로만 불러도 이걸로 식별해 화 사이 이름을 통일하게 한다.
function castRoster(chars) {
  return (chars || [])
    .filter((c) => c?.name?.trim())
    .map((c) => {
      const al = (c.aliases || '').trim();
      const desc = [c.faction, c.rank, c.base].filter((v) => v && v.trim()).join(' · ');
      return `- ${c.name}${al ? ` (이명: ${al})` : ''}${desc ? ` — ${desc}` : ''}`;
    })
    .join('\n');
}

// 요약 호출에 넘길 맥락 1회 로드(인물 + 큰 줄기). storyId 없으면 빈 맥락.
export async function loadSummaryContext(storyId) {
  if (!storyId) return {};
  const [chars, mem] = await Promise.all([
    loadCharactersForInjection(storyId),
    getStoryMemory(storyId),
  ]);
  return { cast: castRoster(chars), arc: mem?.summary || '' };
}

// 본문 첫 머리말에서 회차 제목을 따온다. 없으면 빈 문자열.
export function parseEpisodeTitle(content) {
  if (!content) return '';
  const m = content.match(/^#{1,4}\s+(.+?)\s*$/m);
  return m ? m[1].trim() : '';
}

// assistant 턴(=결과 본문) 중 요약이 빠진 것을 골라 생성·저장한다(upto 인덱스 전까지).
// 오직 결과 본문만 요약한다(유저 프롬프트는 넣지 않음). turns 객체에 summary를 채워 넣는다.
export async function ensureEpisodeSummaries(turns, ctx = {}, upto = turns.length) {
  const limit = Math.min(upto, turns.length);
  for (let i = 0; i < limit; i++) {
    const t = turns[i];
    if (t.role === 'assistant' && t.id != null && !t.summary && t.content?.trim()) {
      const digest = await summarizeEpisode(t.content, ctx);
      if (digest) {
        t.summary = digest;
        await setTurnSummary(t.id, digest);
      }
    }
  }
}

// 연대 문헌 목록 — 각 화의 { id, ep, title, summary }.
export function buildChronicle(turns) {
  const list = [];
  let ep = 0;
  for (const t of turns) {
    if (t.role !== 'assistant' || !t.content?.trim()) continue;
    ep += 1;
    list.push({
      id: t.id ?? null,
      ep,
      title: parseEpisodeTitle(t.content) || `제${ep}화`,
      summary: t.summary || null,
    });
  }
  return list;
}

// 컨텍스트용 — cutoff 이전 assistant 턴들 중 '주입할 최근 limit개'의 인덱스.
// (전 화를 다 넣지 않는다 — 그 이전은 앵커로만 불러온다.)
export function injectionIndices(turns, cutoff, limit) {
  const idxs = [];
  for (let i = 0; i < cutoff; i++) {
    if (turns[i].role === 'assistant' && turns[i].content?.trim()) idxs.push(i);
  }
  return idxs.slice(-limit); // 최근 limit개만
}

// 지정한 인덱스의 화들만 요약 보장(없으면 생성·저장). 오직 결과 본문만 요약.
export async function ensureSummariesAt(turns, indices, ctx = {}) {
  for (const i of indices) {
    const t = turns[i];
    if (t.id != null && !t.summary && t.content?.trim()) {
      const digest = await summarizeEpisode(t.content, ctx);
      if (digest) {
        t.summary = digest;
        await setTurnSummary(t.id, digest);
      }
    }
  }
}

// 지정한 화들을 '제목 + 요약'으로 시간순 조립(요약 없으면 본문 폴백). 화 번호는 전체 기준.
export function assembleFromIndices(turns, indices) {
  const epOf = new Map();
  let ep = 0;
  for (let i = 0; i < turns.length; i++) {
    if (turns[i].role === 'assistant' && turns[i].content?.trim()) {
      ep += 1;
      epOf.set(i, ep);
    }
  }
  const parts = [];
  for (const i of indices) {
    const t = turns[i];
    const title = parseEpisodeTitle(t.content) || `제${epOf.get(i)}화`;
    parts.push(`【${title}】\n${t.summary || t.content}`);
  }
  return parts.length ? parts.join('\n\n') : null;
}
