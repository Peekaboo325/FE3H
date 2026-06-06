// ─────────────────────────────────────────────────────────────────────────
//  컨텍스트 윈도우 — 클로드에 '전체 대화'가 아니라 다음 세 겹으로 보낸다(CLAUDE.md §4):
//    ① 큰 줄기(전체 흐름)   — 아주 옛 화들을 거시 줄거리 하나로 압축(천천히 갱신)
//    ② 최근 화별 요약        — 큰 줄기에 아직 안 녹은 최근 화들
//    ③ 최근 2화 원문         — messages로 (즉각 연속성)
//
//  큰 줄기는 화별 요약(연대 문헌)에서 굴린다 — 원문을 다시 안 읽음. 화수가 쌓여도
//  주입량이 일정. 안 녹은 화는 ②로 그대로 들어가므로 갱신 주기와 무관하게 빈틈 0.
//
//  저장: 큰 줄기 = stories.summary, 어디까지 녹였나 = stories.summary_turn_id.
//  안전: summary 컬럼/ Gemini가 없으면 그 화는 본문 폴백 → 맥락 유실 0.
// ─────────────────────────────────────────────────────────────────────────

import { loadTurnsForSummary, getStoryMemory, setStoryMemory } from './db.mjs';
import { ensureSummariesAt, assembleFromIndices } from './chronicle.mjs';
import { summarizeArc } from './summarize.mjs';

export const KEEP_TURNS = 5; // 원문으로 보낼 최근 턴(최근 2화 + 새 입력)
export const WINDOW_MIN = 20; // 큰 줄기 밖에서 늘 유지할 최근 화 요약 수
export const WINDOW_MAX = 30; // 안 녹은 화가 이만큼 차면 오래된 것부터 큰 줄기로 접는다

function toMessages(turns) {
  return turns.map((t) => ({ role: t.role, content: t.content }));
}

export async function prepareConversation(storyId, clientMessages) {
  if (!storyId) return { messages: clientMessages, summary: null };

  const { turns, hasSummaryCol } = await loadTurnsForSummary(storyId);
  if (!turns.length) return { messages: clientMessages, summary: null };

  const cutoff = turns.length - KEEP_TURNS;
  if (cutoff <= 0) return { messages: toMessages(turns), summary: null }; // 짧음 — 전부 원문
  if (!hasSummaryCol) return { messages: toMessages(turns), summary: null }; // 컬럼 전 — 안전 폴백

  // 요약존 = cutoff 이전의 서술자(assistant) 턴 인덱스.
  const zone = [];
  for (let i = 0; i < cutoff; i++) {
    if (turns[i].role === 'assistant' && turns[i].content?.trim()) zone.push(i);
  }

  // 큰 줄기 읽기.
  let { summary: arc, summaryTurnId: arcThrough } = await getStoryMemory(storyId);
  arcThrough = arcThrough || 0;

  // 아직 큰 줄기에 안 녹은 화(= 그 포인터 이후) — 주입·접기 양쪽에 필요하니 요약 보장.
  let unarced = zone.filter((i) => (turns[i].id ?? 0) > arcThrough);
  await ensureSummariesAt(turns, unarced);

  // 접기: 안 녹은 게 WINDOW_MAX 넘으면, 오래된 것부터 WINDOW_MIN 남을 때까지 큰 줄기로.
  if (unarced.length > WINDOW_MAX) {
    const foldIdx = unarced.slice(0, unarced.length - WINDOW_MIN);
    const foldSummaries = foldIdx.map((i) => turns[i].summary);
    if (foldSummaries.length && foldSummaries.every(Boolean)) {
      const newArc = await summarizeArc(arc, foldSummaries);
      if (newArc) {
        arc = newArc;
        arcThrough = turns[foldIdx[foldIdx.length - 1]].id ?? arcThrough;
        await setStoryMemory(storyId, arc, arcThrough);
        unarced = unarced.slice(foldIdx.length); // 남은 = 최근 WINDOW_MIN
      }
    }
  }

  // 조립: ① 큰 줄기 + ② 안 녹은 최근 화 요약.
  const recent = assembleFromIndices(turns, unarced);
  let summary = '';
  if (arc) summary += `[큰 줄기 — 전체 흐름]\n${arc}\n\n`;
  if (recent) summary += `[최근 줄거리]\n${recent}`;
  summary = summary.trim() || null;

  // ③ 최근 창만 원문으로(첫 턴이 본문이면 유저 턴부터 시작하게 다듬음).
  let window = turns.slice(cutoff);
  while (window.length && window[0].role !== 'user') window = window.slice(1);
  return { messages: toMessages(window), summary };
}

// 요약을 시스템 프롬프트에 붙일 블록으로(있을 때만).
export function buildSummaryBlock(summary) {
  if (!summary) return null;
  return (
    '# 지금까지의 줄거리\n' +
    '아래는 이 이야기의 큰 흐름과 최근 줄거리다. 가장 최근 장면들은 뒤의 대화에 원문으로 주어진다.\n\n' +
    summary
  );
}
