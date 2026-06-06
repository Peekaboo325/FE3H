// ─────────────────────────────────────────────────────────────────────────
//  연대기 기록관 / Context Picker — Gemini Flash 경량 처리 (CLAUDE.md §3).
//
//  메인 본문(클로드)과 달리 '문장력 불필요한 기계적 처리'라 Gemini 몫이다.
//   · summarizePlot   — 누적 줄거리 요약(컨텍스트 윈도우용)
//   · pickAnchorBrief — 유저가 지목한 과거 회차를 '목적'에 맞춰 요약/발췌/전문으로 추림
//
//  열쇠(GEMINI_API_KEY)가 없거나 호출이 실패하면 null을 돌려준다 →
//  부르는 쪽은 안전하게 폴백한다(맥락 유실/오작동 0).
// ─────────────────────────────────────────────────────────────────────────

const GEMINI_MODEL = 'gemini-2.5-flash'; // 경량 처리 — Flash로 충분(쌈)

// 내부 공용 — Gemini에 프롬프트 하나 던지고 텍스트만 받아온다.
async function callGemini(prompt, { temperature = 0.3, maxOutputTokens = 2048 } = {}) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return null;
  try {
    const r = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${key}`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature, maxOutputTokens },
        }),
      },
    );
    if (!r.ok) {
      console.error('[연대기] Gemini 호출 실패:', r.status, await r.text());
      return null;
    }
    const d = await r.json();
    const text =
      d?.candidates?.[0]?.content?.parts?.map((p) => p.text || '').join('') ?? '';
    return text.trim() || null;
  } catch (e) {
    console.error('[연대기] Gemini 오류:', e?.message || e);
    return null;
  }
}

// 한 화(서술자 본문=결과값)를 '연대 문헌'에 남길 기록으로 정제한다 — 화별 1:1 요약.
//  ⚠️ 유저 프롬프트(작가 지시)는 입력에 넣지 않는다 — 오직 '결과 본문'만 요약한다.
//  · 사건·인과 + 명시적 관계·상태 변화만. 심리 추측·미사여구·날짜는 버린다.
export async function summarizeEpisode(body) {
  if (!body?.trim()) return null;

  const prompt = `너는 포드라의 '왕실 사관'이다. 아래 한 화(서술자 본문)를 '연대 문헌'에 남길 기록으로 정제하라.

[요약 규칙]
- 한국어. 건조하고 사실 중심으로, 'A가 B하다' 꼴.
- 본문에서 실제로 일어난 사건의 인과와 인물의 행동·결정·결과를 2~4문장으로.
- 심리 추측("슬퍼 보인다") 금지 — 확정된 행동·발화·상태만.
- 수식어·미사여구·날짜는 덜어낸다. 본문에 없는 것은 적지 않는다.

[관계·상태 변화]
- 이 화에서 '명시적으로' 바뀐 것만 0~3개. 없으면 그 줄을 통째로 생략한다.
- 분류는 2글자(관계/상태/신분/위치/소지/정보/심리 등) + 한 줄.

[출력 형식] — 아래 그대로, 머리말·해설 없이:
<요약 2~4문장>
변화: 관계: …. / 상태: ….

[본문]
${body}`;

  return callGemini(prompt, { temperature: 0.2, maxOutputTokens: 700 });
}

// 유저가 지목한 과거 회차를 '참고 목적'에 맞춰 알맞은 형태로 추려 브리프를 만든다.
export async function pickAnchorBrief(userInput, episodes) {
  if (!episodes?.length) return null;
  const 회차들 = episodes
    .map((e) => `--- ${e.n}화 ---\n${e.content}`)
    .join('\n\n');

  const prompt = `너는 인터랙티브 픽션의 'Context Picker'다. 작가(유저)가 이번 화를 쓰며 과거 회차를 참고하려 한다.
[이번 요청]에 담긴 '참고 목적'을 분류하고, 그 목적에 맞춰 [참고 회차]를 가장 알맞은 형태로 추려, 본문 생성기에 넘길 '참고 브리프'를 만든다.

목적별 추리는 방식:
- 문체 참고 → 그 회차의 대표 문장 2~3개만 발췌(문체·리듬이 드러나게).
- 대사 회수 → 해당 인물의 핵심 대사만 발췌(누가 말했는지 표기).
- 사건 회수 → 무슨 일이 있었는지 사실만 간결 요약.
- 감정선 연결 → 인물의 감정 변화만 짧게 요약.
- 장면 대구 → 그 장면의 구도·분위기를 요약 + 핵심 묘사 1~2개 발췌.
- 목적이 불분명하면 간결 요약.

규칙:
- 한국어. 머리말·해설 없이 브리프 본문만.
- 회차가 여럿이면 각 회차를 "[N화 · {분류한 목적}]" 머리로 구분.
- 분량은 목적에 필요한 만큼만(전문을 통째로 베끼지 말 것).

[이번 요청]
${userInput}

[참고 회차]
${회차들}`;

  return callGemini(prompt, { temperature: 0.4, maxOutputTokens: 2048 });
}
