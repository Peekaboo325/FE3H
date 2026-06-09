// ─────────────────────────────────────────────────────────────────────────
//  연대기 기록관 / Context Picker — Gemini Flash 경량 처리 (CLAUDE.md §3).
//
//  메인 본문(클로드)과 달리 '문장력 불필요한 기계적 처리'라 Gemini 몫이다.
//   · summarizePlot   — 누적 줄거리 요약(컨텍스트 윈도우용)
//   · pickAnchorBrief — 유저가 지목한 과거 회차를 '목적'에 맞춰 요약/발췌/전문으로 추림
//
//  열쇠(GEMINI_API_KEY)가 없거나 호출이 실패하면 null을 돌려준다 →
//  부르는 쪽은 안전하게 폴백한다(맥락 유실/오작동 0).
//
//  ⚠️ Gemini엔 박제 세계관(SYSTEM)·고유명사 사전을 넣지 않는다(CLAUDE.md §3) —
//     그건 클로드 본문 전용이다. 프롬프트는 그 과제 텍스트(본문/요약/지목 회차)만.
//     (그래서 이 파일은 worldview/nameDict를 import하지 않는다.)
// ─────────────────────────────────────────────────────────────────────────

const GEMINI_MODEL = 'gemini-2.5-flash'; // 경량 처리 — Flash로 충분(쌈)

// 일시적 과부하(503·429 등) 대비 — 짧게 재시도하되, 한 번 '다운'을 감지하면
// 잠깐(쿨다운) 모든 호출을 즉시 폴백시킨다(차단기) → 무더기로 두들기지 않음(비용·헛걸음 방지).
const 일시적 = new Set([429, 500, 503, 504]); // 재시도 대상(나머지 영구 에러는 즉시 폴백)
const 최대재시도 = 2; // 최초 1회 + 재시도 2회 = 최대 3회
const 백오프 = [1000, 2000]; // 재시도 전 대기(1초 → 2초)
const 쿨다운 = 30_000; // 다운 감지 후 이 시간 동안은 호출 건너뜀
let 차단해제시각 = 0; // Date.now()가 이 값을 넘기 전엔 Gemini를 부르지 않는다(차단기)
const 잠깐 = (ms) => new Promise((res) => setTimeout(res, ms));

// 내부 공용 — Gemini에 프롬프트 하나 던지고 텍스트만 받아온다.
//  thinkingBudget = 답 전에 쓸 '사고' 토큰 한도(기본 0=끔). gemini-2.5-flash는 사고가
//  maxOutputTokens를 같이 깎으므로, 사고를 켜는 호출은 maxOutputTokens를 함께 키워 잘림을 막는다.
//   · 화별 요약(한 장면 추출) = 0   · 앵커 추림·큰 줄기 병합(판단 필요) = 일부 켬
async function callGemini(prompt, { temperature = 0.3, maxOutputTokens = 2048, thinkingBudget = 0 } = {}) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return null;
  if (Date.now() < 차단해제시각) return null; // 차단기 열림 — 즉시 폴백(다운 중엔 안 두들김)

  for (let 시도 = 0; 시도 <= 최대재시도; 시도++) {
    try {
      const r = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${key}`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { temperature, maxOutputTokens, thinkingConfig: { thinkingBudget } },
          }),
        },
      );
      if (r.ok) {
        const d = await r.json();
        const text =
          d?.candidates?.[0]?.content?.parts?.map((p) => p.text || '').join('') ?? '';
        return text.trim() || null;
      }
      const 사유 = await r.text();
      // 일시적이고 시도 여유가 있으면 잠깐 쉬고 재시도, 아니면 폴백.
      if (일시적.has(r.status) && 시도 < 최대재시도) {
        console.error(`[연대기] Gemini ${r.status} 일시적 — 재시도 ${시도 + 1}/${최대재시도}`);
        await 잠깐(백오프[시도] ?? 2000);
        continue;
      }
      console.error('[연대기] Gemini 호출 실패:', r.status, 사유);
      if (일시적.has(r.status)) 차단해제시각 = Date.now() + 쿨다운; // 다운 — 잠깐 차단기 올림
      return null;
    } catch (e) {
      // 네트워크 등 예외도 일시적으로 보고 한정 재시도.
      if (시도 < 최대재시도) {
        console.error(`[연대기] Gemini 오류(재시도 ${시도 + 1}/${최대재시도}):`, e?.message || e);
        await 잠깐(백오프[시도] ?? 2000);
        continue;
      }
      console.error('[연대기] Gemini 오류:', e?.message || e);
      return null;
    }
  }
  return null;
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

  // 한 장면 추출이라 사고 불필요(0). 잘림 여유로 출력 1024.
  return callGemini(prompt, { temperature: 0.2, maxOutputTokens: 1024 });
}

// 큰 줄기(전체 서사의 척추)를 갱신한다 — 기존 큰 줄기 + 새로 편입할 화별 요약들 → 거시 줄거리.
// 화별 요약(연대 문헌)을 입력으로 받으므로 원문을 다시 읽지 않는다(쌈).
export async function summarizeArc(priorArc, episodeSummaries) {
  if (!episodeSummaries?.length) return null;
  const 새기록 = episodeSummaries.map((s, i) => `(${i + 1})\n${s}`).join('\n\n');

  const prompt = `너는 포드라의 '대연대기 편찬자'다. 이 이야기의 '큰 줄기'(전체 서사의 척추)를 갱신하라.
[기존 큰 줄기]에 [새로 편입할 회차 기록]을 녹여, 하나의 거시적 줄거리로 다시 쓴다.

규칙:
- 한국어. 중심 갈등, 큰 전환점, 인물 관계의 결정적 변화, 미해결 긴장, 전체 궤적만 남긴다.
- 장면 디테일·대사·사소한 사건은 버린다(그건 화별 기록의 몫).
- 시간 순서를 지키되 큰 흐름으로 압축한다.
- 전체 분량은 한두 문단(최대 ~10문장)으로 유지한다 — 길어지면 오래된 것부터 더 압축.
- 머리말·해설 없이, 갱신된 큰 줄기 본문만 출력한다.

[기존 큰 줄기]
${priorArc || '(아직 없음 — 처음부터 정리)'}

[새로 편입할 회차 기록]
${새기록}`;

  // 여러 화를 가로질러 무엇을 남길지 판단 → 사고 일부 켬(1024). 출력은 사고+답 합쳐 잘리지 않게 3072.
  return callGemini(prompt, { temperature: 0.3, maxOutputTokens: 3072, thinkingBudget: 1024 });
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

  // 참고 목적 분류 + 선별 발췌라 약간의 사고가 도움(512). 출력은 사고+답 합쳐 3072.
  return callGemini(prompt, { temperature: 0.4, maxOutputTokens: 3072, thinkingBudget: 512 });
}
