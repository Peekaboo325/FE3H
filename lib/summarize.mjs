// ─────────────────────────────────────────────────────────────────────────
//  연대기 기록관 — 줄거리 요약 (Gemini Flash).
//
//  메인 본문(클로드)과 달리 '문장력 불필요한 기계적 처리'라 Gemini 몫이다(CLAUDE.md §3).
//  기존 누적 줄거리에 새로 밀려난 옛 장면들을 녹여 하나의 줄거리로 갱신한다.
//  열쇠(GEMINI_API_KEY)가 없거나 호출이 실패하면 null을 돌려준다 →
//  부르는 쪽은 '요약 없음'으로 보고 안전하게 전체 원문을 보낸다(맥락 유실 0).
// ─────────────────────────────────────────────────────────────────────────

const GEMINI_MODEL = 'gemini-2.5-flash'; // 요약은 경량 처리 — Flash로 충분(쌈)

export async function summarizePlot(prior, newTurns) {
  const key = process.env.GEMINI_API_KEY;
  if (!key || !newTurns?.length) return null;

  const 발췌 = newTurns
    .map((t) => `${t.role === 'user' ? '[지시]' : '[본문]'} ${t.content}`)
    .join('\n\n');

  const prompt = `너는 인터랙티브 픽션의 '연대기 기록관'이다. 아래 [기존 줄거리]에 [새 장면]을 녹여, 하나의 매끄러운 누적 줄거리로 갱신하라.

규칙:
- 한국어. 사건의 인과와 인물 관계의 변화를 중심으로 간결하게.
- 시간 순서를 지키고, 곁가지·묘사는 쳐내고 줄기만 남긴다.
- 추측하거나 지어내지 말 것. 주어진 내용만 정리한다.
- 머리말·해설 없이, 갱신된 줄거리 '본문만' 출력한다.

[기존 줄거리]
${prior || '(아직 없음 — 처음부터 정리)'}

[새 장면]
${발췌}`;

  try {
    const r = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${key}`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.3, maxOutputTokens: 2048 },
        }),
      },
    );
    if (!r.ok) {
      console.error('[연대기] Gemini 요약 실패:', r.status, await r.text());
      return null;
    }
    const d = await r.json();
    const text =
      d?.candidates?.[0]?.content?.parts?.map((p) => p.text || '').join('') ?? '';
    return text.trim() || null;
  } catch (e) {
    console.error('[연대기] Gemini 요약 오류:', e?.message || e);
    return null;
  }
}
