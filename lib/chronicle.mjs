// ─────────────────────────────────────────────────────────────────────────
//  연대 문헌 — 화별 요약(왕실 사관의 기록).
//
//  화별 요약 하나가 두 곳에 쓰인다(단일 진실):
//   · 연대 문헌(유저가 읽는 화별 줄거리)
//   · 컨텍스트 윈도우(옛 화는 이 요약으로 클로드에 주입 → 토큰 절감)
//
//  제목은 새로 짓지 않는다 — 본문에 이미 있는 회차 제목(예: "제1화 · 첫눈")을 따온다.
// ─────────────────────────────────────────────────────────────────────────

import { setTurnSummary } from './db.mjs';
import { summarizeEpisode } from './summarize.mjs';

// 본문 첫 머리말에서 회차 제목을 따온다. 없으면 빈 문자열.
export function parseEpisodeTitle(content) {
  if (!content) return '';
  const m = content.match(/^#{1,4}\s+(.+?)\s*$/m);
  return m ? m[1].trim() : '';
}

// assistant 턴 중 요약이 빠진 것을 골라 생성·저장한다(upto 인덱스 전까지).
// 한 화 = 직전 user 지시 + 그 assistant 본문. turns 객체에 summary를 채워 넣는다.
export async function ensureEpisodeSummaries(turns, upto = turns.length) {
  const limit = Math.min(upto, turns.length);
  for (let i = 0; i < limit; i++) {
    const t = turns[i];
    if (t.role === 'assistant' && t.id != null && !t.summary && t.content?.trim()) {
      const directive = i > 0 && turns[i - 1].role === 'user' ? turns[i - 1].content : '';
      const digest = await summarizeEpisode(directive, t.content);
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

// 지정한 인덱스의 화들만 요약 보장(없으면 생성·저장). 한 화 = 직전 user 지시 + 본문.
export async function ensureSummariesAt(turns, indices) {
  for (const i of indices) {
    const t = turns[i];
    if (t.id != null && !t.summary && t.content?.trim()) {
      const directive = i > 0 && turns[i - 1].role === 'user' ? turns[i - 1].content : '';
      const digest = await summarizeEpisode(directive, t.content);
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
