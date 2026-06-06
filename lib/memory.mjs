// ─────────────────────────────────────────────────────────────────────────
//  컨텍스트 윈도우 — 클로드에 '전체 대화'가 아니라
//  '화별 요약(연대 문헌) + 최근 N턴 원문'만 보낸다(CLAUDE.md §4).
//
//  옛 화는 '화별 요약'으로 주입한다. 이 요약은 연대 문헌과 같은 단일 진실
//  (lib/chronicle.mjs). 화수가 쌓여도 입력 토큰이 폭증하지 않는다.
//
//  안전 원칙: summary 컬럼이 없거나(SQL 전) Gemini가 없어 요약을 못 만들면,
//  그 화는 본문으로 폴백한다 → 어떤 경우에도 맥락이 새지 않는다.
// ─────────────────────────────────────────────────────────────────────────

import { loadTurnsForSummary } from './db.mjs';
import { ensureEpisodeSummaries, assembleContextSummary } from './chronicle.mjs';

// 원문으로 그대로 보낼 최근 턴 수 = 최근 2화(프롬프트+본문 4턴) + 이번 새 입력.
export const KEEP_TURNS = 5;

function toMessages(turns) {
  return turns.map((t) => ({ role: t.role, content: t.content }));
}

// 이번 호출에 보낼 { messages, summary }를 만든다.
//  - storyId 없음(휘발 모드)·DB 비었으면: 받은 그대로(클라 messages).
//  - 짧으면: 전부 원문.
//  - 길면: 옛 화는 화별 요약으로, 최근 KEEP_TURNS만 원문.
export async function prepareConversation(storyId, clientMessages) {
  if (!storyId) return { messages: clientMessages, summary: null };

  const { turns, hasSummaryCol } = await loadTurnsForSummary(storyId);
  if (!turns.length) return { messages: clientMessages, summary: null };

  const cutoff = turns.length - KEEP_TURNS;
  if (cutoff <= 0) {
    // 아직 짧다 — 전부 원문, 요약 불필요.
    return { messages: toMessages(turns), summary: null };
  }
  if (!hasSummaryCol) {
    // summary 컬럼 전 → 안전하게 전체 원문(기존 동작).
    return { messages: toMessages(turns), summary: null };
  }

  // 옛 화(cutoff 이전)의 요약을 보장(없는 것만 Gemini로 생성·저장).
  await ensureEpisodeSummaries(turns, cutoff);
  const summary = assembleContextSummary(turns, cutoff);

  // 최근 창만 원문으로. 혹시 첫 턴이 본문(assistant)이면 유저 턴부터 시작하도록 다듬는다.
  let window = turns.slice(cutoff);
  while (window.length && window[0].role !== 'user') window = window.slice(1);
  return { messages: toMessages(window), summary };
}

// 요약을 시스템 프롬프트에 붙일 블록으로(있을 때만).
export function buildSummaryBlock(summary) {
  if (!summary) return null;
  return (
    '# 지금까지의 줄거리 (연대 문헌)\n' +
    '이 이야기가 여기까지 흘러온 줄거리를 화별로 정리한 것이다. 가장 최근 장면들은 뒤의 대화에 원문으로 주어진다.\n\n' +
    summary
  );
}
