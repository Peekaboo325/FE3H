// ─────────────────────────────────────────────────────────────────────────
//  공용 Gemini 클라이언트 — 모든 Gemini 호출의 단일 통로(legacy services/gemini/client.ts 계승).
//
//  여기 한 곳에 '견고함'을 모은다: 일시적 과부하(503·429·5xx) 재시도 + 지터 백오프 +
//  타임아웃 + 다운 감지 차단기. 요약·보고서·(앞으로) 편지·해시태그가 전부 이걸 거치므로,
//  "한 군데 재시도 빠뜨림" 같은 버그가 구조적으로 안 생긴다.
//
//  ⚠️ Gemini엔 박제 세계관(SYSTEM)·고유명사 사전을 넣지 않는다(CLAUDE.md §3) — 호출부 책임.
// ─────────────────────────────────────────────────────────────────────────

const DEFAULT_MODEL = 'gemini-2.5-flash';
const 일시적 = new Set([429, 500, 502, 503, 504]); // 재시도 대상(그 외·파싱 실패는 호출부가 폴백)
const TIMEOUT_MS = 120_000; // 멈춤 방지(legacy와 동일). 무거운 보고서도 이 안에 끝남
const 최대시도 = 3; // 최초 + 재시도 2회
const 쿨다운 = 30_000; // 다운 감지 후 이만큼은 모든 호출 즉시 폴백(무더기 두들김 방지)
let 차단해제시각 = 0; // Date.now()가 이 값을 넘기 전엔 호출 안 함

const 잠깐 = (ms) => new Promise((res) => setTimeout(res, ms));

// 지터 백오프(legacy): 3^시도 × 기준 + 무작위 0~2초. 429는 더 길게.
function 대기시간(시도, status) {
  const 기준 = status === 429 ? 5000 : 1500;
  return Math.pow(3, 시도) * 기준 + Math.random() * 2000;
}

// Gemini에 프롬프트 하나 던지고 { text, finish, error, status }를 돌려준다.
//  opts: { temperature, maxOutputTokens, thinkingBudget(기본 0=끔), json(true=JSON 모드), model, tag }
export async function callGemini(prompt, opts = {}) {
  const {
    temperature = 0.3,
    maxOutputTokens = 2048,
    thinkingBudget = 0,
    json = false,
    model = DEFAULT_MODEL,
    tag = 'Gemini',
  } = opts;

  const key = process.env.GEMINI_API_KEY;
  if (!key) return { text: null, error: 'GEMINI_API_KEY 없음' };
  if (Date.now() < 차단해제시각) return { text: null, error: '과부하 쿨다운(차단기)' };

  const generationConfig = {
    temperature,
    maxOutputTokens,
    thinkingConfig: { thinkingBudget },
    ...(json ? { responseMimeType: 'application/json' } : {}),
  };
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;

  let 마지막오류 = '';
  for (let 시도 = 0; 시도 < 최대시도; 시도++) {
    const 컨트롤러 = new AbortController();
    const 타이머 = setTimeout(() => 컨트롤러.abort(), TIMEOUT_MS);
    try {
      const r = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig }),
        signal: 컨트롤러.signal,
      });
      clearTimeout(타이머);

      if (!r.ok) {
        const body = await r.text().catch(() => '');
        if (일시적.has(r.status) && 시도 < 최대시도 - 1) {
          const ms = 대기시간(시도, r.status);
          console.error(`[${tag}] Gemini ${r.status} 일시적 — 재시도 ${시도 + 1}/${최대시도 - 1} (${Math.round(ms)}ms)`);
          await 잠깐(ms);
          continue;
        }
        if (일시적.has(r.status)) 차단해제시각 = Date.now() + 쿨다운; // 다운 — 잠깐 차단기 올림
        console.error(`[${tag}] Gemini 호출 실패:`, r.status, body);
        return { text: null, error: `Gemini ${r.status}`, status: r.status };
      }

      const d = await r.json();
      const finish = d?.candidates?.[0]?.finishReason; // STOP / MAX_TOKENS / SAFETY ...
      const text = d?.candidates?.[0]?.content?.parts?.map((p) => p.text || '').join('') ?? '';
      return {
        text: text.trim() || null,
        finish,
        error: text.trim() ? null : `빈 응답${finish ? ` (${finish})` : ''}`,
      };
    } catch (e) {
      clearTimeout(타이머);
      마지막오류 = e?.name === 'AbortError' ? '타임아웃' : e?.message || String(e);
      // 타임아웃·네트워크 등도 일시적으로 보고 한정 재시도.
      if (시도 < 최대시도 - 1) {
        const ms = 대기시간(시도, 0);
        console.error(`[${tag}] Gemini 오류(재시도 ${시도 + 1}/${최대시도 - 1}): ${마지막오류} (${Math.round(ms)}ms)`);
        await 잠깐(ms);
        continue;
      }
      console.error(`[${tag}] Gemini 오류:`, 마지막오류);
      return { text: null, error: 마지막오류 };
    }
  }
  return { text: null, error: 마지막오류 || '재시도 소진(과부하 지속)' };
}
