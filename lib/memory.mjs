// ─────────────────────────────────────────────────────────────────────────
//  컨텍스트 윈도우 — 클로드에 '전체 대화'가 아니라
//  '지금까지의 줄거리 요약 + 최근 N턴 원문'만 보낸다(CLAUDE.md §4).
//
//  화수가 쌓여도 입력 토큰이 폭증하지 않게 하는 핵심. story.mjs(배포)와
//  server/index.mjs(로컬)가 같은 로직을 쓰도록 한 곳에 모았다.
//
//  안전 원칙: 요약이 아직 옛 턴까지 닿지 못했으면(Gemini 미설정/실패 등)
//  자르지 않고 전체 원문을 보낸다 → 어떤 경우에도 맥락이 새지 않는다.
// ─────────────────────────────────────────────────────────────────────────

import { loadTurns, getStoryMemory, setStoryMemory } from './db.mjs';
import { summarizePlot } from './summarize.mjs';

// 원문으로 그대로 보낼 최근 턴 수 = 최근 2화(프롬프트+본문 4턴) + 이번 새 입력.
export const KEEP_TURNS = 5;

function toMessages(turns) {
  return turns.map((t) => ({ role: t.role, content: t.content }));
}

// 이번 호출에 보낼 { messages, summary }를 만든다.
//  - storyId 없음(휘발 모드)·DB 비었으면: 받은 그대로(클라 messages).
//  - 짧으면: 전부 원문.
//  - 길면: 옛 턴은 요약(필요할 때만 Gemini 갱신), 최근 KEEP_TURNS만 원문.
export async function prepareConversation(storyId, clientMessages) {
  if (!storyId) return { messages: clientMessages, summary: null };

  const { turns } = await loadTurns(storyId); // 시간순, 방금 저장된 새 유저 입력까지 포함
  if (!turns.length) return { messages: clientMessages, summary: null };

  const cutoff = turns.length - KEEP_TURNS;
  if (cutoff <= 0) {
    // 아직 짧다 — 전부 원문, 요약 불필요.
    return { messages: toMessages(turns), summary: null };
  }

  // 옛 턴이 있다 → 요약이 cutoff 직전까지 닿도록 갱신(이미 최신이면 호출 안 함).
  let { summary, summaryTurnId } = await getStoryMemory(storyId);
  const needId = turns[cutoff - 1].id; // 요약이 포함해야 할 마지막 턴
  if (!summaryTurnId || summaryTurnId < needId) {
    const startIdx = summaryTurnId
      ? turns.findIndex((t) => t.id === summaryTurnId) + 1
      : 0;
    const fold = turns.slice(Math.max(0, startIdx), cutoff); // 새로 밀려난 옛 턴들
    if (fold.length) {
      const updated = await summarizePlot(summary, fold);
      if (updated) {
        summary = updated;
        summaryTurnId = needId;
        await setStoryMemory(storyId, summary, summaryTurnId);
      }
    }
  }

  // 요약이 끝내 cutoff까지 못 닿으면(Gemini 없음/실패) → 안전하게 전체 원문.
  if (!summary || !summaryTurnId || summaryTurnId < needId) {
    return { messages: toMessages(turns), summary: null };
  }

  // 최근 창만 원문으로. 혹시 첫 턴이 본문(assistant)이면 유저 턴부터 시작하도록 다듬는다.
  let window = turns.slice(cutoff);
  while (window.length && window[0].role !== 'user') window = window.slice(1);
  return { messages: toMessages(window), summary };
}

// 요약을 시스템 프롬프트에 붙일 블록으로(있을 때만).
export function buildSummaryBlock(summary) {
  if (!summary) return null;
  return (
    '# 지금까지의 줄거리\n' +
    '이 이야기가 여기까지 흘러온 줄거리다. 가장 최근 장면들은 뒤의 대화에 원문으로 주어진다.\n\n' +
    summary
  );
}
