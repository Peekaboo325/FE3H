// ─────────────────────────────────────────────────────────────────────────
//  갈래(岐) 엔진 — '다음 화에서 무슨 일이 벌어질 수 있나'의 갈래 셋(구상 단계). 도면 docs/갈래_설계.md.
//
//  배경(2026-07-06 빌더 상담): 막히는 순간 앱 안에 갈 곳이 없어 바깥 AI로 나가고, 거기서 본문까지
//  받아와 인터랙션이 시작되기 전에 이야기가 끝나던 문제. 파이프라인의 빈 첫 칸을 채운다:
//  갈래(무슨 일) → 연출(어떻게) → 본문(렌더) → 교정(다듬기) — 뒤의 셋은 기존.
//
//  Flash·온디맨드·JSON(모티프 대장 패턴). §3: 세계관·nameDict 미주입 — 이 이야기 자체(요약·최근 화·
//  인물 요지·기록 지침)만 준다. 출력은 '씨앗'으로 강제 — 산문 통째(바깥 AI의 병)가 재발하지 않게.
// ─────────────────────────────────────────────────────────────────────────

import { callGemini } from './gemini.mjs';
import { prepareConversation } from './memory.mjs';
import { loadCharactersForInjection, getGuidance, loadRecentTurns } from './db.mjs';
import { buildGuidanceBlock } from './guidance.mjs';

// 작성 가드 — 예시(few-shot) 절대 금지(§3), 규칙·금지로만.
const 갈래가드 = `너는 이 연재의 다음 화에서 '일어날 수 있는 일'을 궁리하는 조수다. 소설을 쓰는 게 아니다 — 작가가 고를 갈래(사건의 씨앗)만 내놓는다.

[규칙]
- 갈래는 정확히 3개.
- 각 갈래: event = 그 사건이 무엇인지 1~2문장(작가 메모처럼 담백하게, 하십시오체·경어 불필요). stakes = 그 일이 누구·무엇을 흔드는지 1문장.
- 지금까지의 이야기에 이미 있는 인물·긴장·안 매듭진 것에서만 자라게 하라. 새 인물·새 설정·이야기에 없는 사실을 지어내지 마라.
- 이미 벌어져 끝난 일을 '다음'으로 제안하지 마라. 줄거리·최근 화에 이미 일어난 사건(누가 왔다 갔다·무엇이 결판났다)은 다음이 아니다 — 그 사건이 남긴 여파나 아직 열려 있는 실에서만 다음을 뽑아라.
- 세 갈래는 서로 다른 방향이어야 한다 — 같은 종류의 변주 셋이면 실패다. 흔드는 인물과 판(관계·정세·내면)을 서로 다르게 하라.
- 완성된 소설 문장·장면 묘사·대사를 쓰지 마라. 결말을 단정하지 마라 — 씨앗까지만, 어떻게 흘러갈지는 작가 몫이다.
- JSON으로만 답하라: {"forks":[{"event":"...","stakes":"..."},{"event":"...","stakes":"..."},{"event":"...","stakes":"..."}]}`;

// 인물 요지 — 약력 통째가 아니라 이름·신원·생사만(§3 최소 입력). 관계·사정은 줄거리가 이미 담는다.
function 인물요지(rows) {
  const lines = (rows || [])
    .filter((r) => r?.name && r.is_active !== false)
    .map((r) => {
      const 신원 = [r.faction, r.rank].filter(Boolean).join(' · ');
      const 생사 = r.life_status && r.life_status !== '생존' ? ` (${r.life_status})` : '';
      return `- ${r.name}${신원 ? ` — ${신원}` : ''}${생사}`;
    });
  return lines.length ? lines.join('\n') : '';
}

// 갈래 뽑기 — 재료(줄거리·최근 화·인물·지침) 조립 → Flash JSON → 검증해 {forks:[{event,stakes}×3]}.
export async function runIdeate({ storyId } = {}) {
  if (!storyId) return { error: '운명의 장이 없습니다.' };

  // 재료 = ①먼 과거 상태(요약: 큰 줄기+최근 화 요약) + ②최근 원문 넉넉히(종결된 사건이 요약 한 줄로
  //  눌려 '되감기 후보'가 나오던 문제 → 갈래는 본문 창(2화)이 아니라 최근 6화 전문을 직접 받는다).
  const [{ summary }, 최근턴, 인물들, 지침] = await Promise.all([
    prepareConversation(storyId, []),
    loadRecentTurns(storyId, 16), // 유저·초안 턴 섞여 있어 넉넉히 → 최근 assistant 6화 확보
    loadCharactersForInjection(storyId),
    getGuidance(storyId).catch(() => ''),
  ]);
  const 최근원문 = (최근턴 || [])
    .filter((t) => t.role === 'assistant' && t.content?.trim())
    .slice(-6)
    .map((t) => t.content.trim())
    .join('\n\n');
  if (!summary && !최근원문) return { error: '아직 갈래를 살필 이야기가 없습니다 — 첫 장면부터 적으십시오.' };

  const 지침블록 = buildGuidanceBlock(지침);
  const 인물블록 = 인물요지(인물들);
  const prompt =
    갈래가드 +
    (지침블록 ? `\n\n${지침블록}` : '') + // 자체 머리말 포함(buildGuidanceBlock) — 갈래도 이 결을 따른다
    (인물블록 ? `\n\n[등장인물 — 이 명단 안에서만]\n${인물블록}` : '') +
    (summary ? `\n\n[지금까지의 줄거리]\n${summary}` : '') +
    (최근원문 ? `\n\n[최근 화 원문 — 이야기가 지금 서 있는 자리]\n${최근원문}` : '') +
    '\n\n[갈래 셋 — JSON만]';

  const { text, error } = await callGemini(prompt, {
    temperature: 0.9, // 구상 = 다양성이 생명
    maxOutputTokens: 1000,
    json: true,
    tag: '갈래',
  });
  if (error || !text) return { error: error || '갈래를 살피지 못했습니다 — 다시 시도하십시오.' };

  try {
    const o = JSON.parse(text);
    const t = (s) => (typeof s === 'string' ? s.trim() : '');
    const forks = (Array.isArray(o?.forks) ? o.forks : [])
      .map((f) => ({ event: t(f?.event), stakes: t(f?.stakes) }))
      .filter((f) => f.event)
      .slice(0, 3);
    if (!forks.length) return { error: '갈래를 살피지 못했습니다 — 다시 시도하십시오.' };
    return { forks };
  } catch {
    return { error: '갈래를 살피지 못했습니다 — 다시 시도하십시오.' };
  }
}
