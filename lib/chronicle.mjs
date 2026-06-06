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

// 컨텍스트용 — cutoff 이전 옛 화들을 '제목 + 요약'으로 시간순 조립.
// 요약이 없는 화는 본문으로 폴백(맥락 유실 방지).
export function assembleContextSummary(turns, cutoff) {
  const parts = [];
  let ep = 0;
  for (let i = 0; i < cutoff; i++) {
    const t = turns[i];
    if (t.role !== 'assistant' || !t.content?.trim()) continue;
    ep += 1;
    const title = parseEpisodeTitle(t.content) || `제${ep}화`;
    parts.push(`【${title}】\n${t.summary || t.content}`);
  }
  return parts.length ? parts.join('\n\n') : null;
}
