// ─────────────────────────────────────────────────────────────────────────
//  분석 보고서 발급소 — Gemini Flash가 인물의 '분석 보고서'를 짓는다 (CLAUDE.md §3).
//
//  보고서 = 약력(설정) + 본문 맥락 + 인연을 읽어 LLM이 발급하는 자기/타자 분석.
//   · 능력치 8종(0~100) + 항목별 한 줄 평
//   · 성격 심층 분석 / 무의식 분석
//   · 평판 6종 (타인의 시선 — CLAUDE.md §1 '각자의 시선으로만')
//   · 대표 인용구 1줄 + 해시태그 5
//
//  메인 본문(클로드)과 달리 '문장력보단 분류·구조화'라 Gemini 몫(summarize.mjs와 같은 결).
//  열쇠(GEMINI_API_KEY)가 없거나 실패하면 null → 부르는 쪽이 안전히 안내한다.
//
//  ⚠️ Gemini엔 박제 세계관(SYSTEM)·고유명사 사전을 넣지 않는다(CLAUDE.md §3) —
//     그건 클로드 본문 전용(지식 보강)이다. 여기 프롬프트는 인물·맥락 등 과제 입력만.
//     (그래서 이 파일은 worldview/nameDict를 import하지 않고 db만 쓴다.)
// ─────────────────────────────────────────────────────────────────────────

import { getCharacter, listCharacters, loadTurnsForSummary, getStoryMemory, setCharacterAnalysis } from './db.mjs';

const GEMINI_MODEL = 'gemini-2.5-flash';
const RECENT_RAW = 8; // 보고서 맥락에 원문으로 넣을 최근 '본문(서술자)' 화 수
const SUMMARY_CAP = 12; // 회차 요약은 가장 최근 이만큼만(그 이전 흐름은 큰 줄기가 담음) — 폭주 방지

// 능력치 8종 — 키(영문)·라벨(한글). 권세(영향력)+위상(신분)은 '입지'로 합쳤다.
export const STAT_KEYS = [
  ['prowess', '무력'],
  ['magic', '마력'],
  ['faith', '신앙'],
  ['intellect', '지성'],
  ['standing', '입지'],
  ['wealth', '재력'],
  ['charm', '매력'],
  ['resilience', '정신'],
];

// Gemini에 JSON 한 덩이를 요청하고 파싱해 돌려준다(응답을 JSON 모드로 강제).
//  보고서는 평판·인용구·분석 등 '창작'과 능력치 균형 '추론'이 섞인 작업이라 thinking을 켠다.
//  ⚠️ gemini-2.5-flash는 thinking이 출력 토큰을 같이 먹어 본문이 잘릴 수 있다 →
//     생각 예산을 한정(thinkingBudget)하고 maxOutputTokens를 넉넉히 줘서 잘림을 막는다.
async function callGeminiJSON(
  prompt,
  { temperature = 0.85, maxOutputTokens = 10000, thinkingBudget = 2048 } = {},
) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return { error: 'GEMINI_API_KEY 없음' };
  try {
    const r = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${key}`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature,
            maxOutputTokens,
            responseMimeType: 'application/json',
            thinkingConfig: { thinkingBudget }, // 생각 켜되 예산 한정(품질 + 잘림 방지)
          },
        }),
      },
    );
    if (!r.ok) {
      const body = await r.text();
      console.error('[보고서] Gemini 호출 실패:', r.status, body);
      return { error: `Gemini ${r.status}` };
    }
    const d = await r.json();
    const finish = d?.candidates?.[0]?.finishReason; // STOP / MAX_TOKENS / SAFETY ...
    const text =
      d?.candidates?.[0]?.content?.parts?.map((p) => p.text || '').join('') ?? '';
    if (!text.trim()) {
      console.error('[보고서] 빈 응답. finishReason:', finish, JSON.stringify(d)?.slice(0, 300));
      if (finish === 'MAX_TOKENS') return { error: '응답이 토큰 한도에서 잘렸습니다 — 다시 시도하십시오.' };
      if (finish === 'SAFETY') return { error: 'Gemini 안전 필터에 걸렸습니다.' };
      return { error: `빈 응답${finish ? ` (${finish})` : ''}` };
    }
    try {
      return { data: JSON.parse(text) };
    } catch {
      // 혹시 코드펜스/잡텍스트가 섞이면 첫 { … 마지막 } 만 떼어 재시도.
      const s = text.indexOf('{');
      const e = text.lastIndexOf('}');
      if (s >= 0 && e > s) {
        try {
          return { data: JSON.parse(text.slice(s, e + 1)) };
        } catch {
          /* fallthrough */
        }
      }
      console.error('[보고서] JSON 파싱 실패. finishReason:', finish, '| 응답 앞부분:', text.slice(0, 400));
      if (finish === 'MAX_TOKENS') return { error: '응답이 토큰 한도에서 잘렸습니다 — 다시 시도하십시오.' };
      return { error: 'JSON 파싱 실패' };
    }
  } catch (e) {
    console.error('[보고서] Gemini 오류:', e?.message || e);
    return { error: e?.message || String(e) };
  }
}

// 인물 한 명의 약력을 프롬프트용 텍스트로 펼친다(보고서는 단건이라 전부 넣는다).
function 약력문(c) {
  const L = [];
  const 이름 = c.english_name ? `${c.name} (${c.english_name})` : c.name;
  L.push(`이름: ${이름}`);
  if (c.aliases) L.push(`이명: ${c.aliases}`);
  if (c.gender) L.push(`성별: ${c.gender}`);
  if (c.faction) L.push(`소속: ${c.faction}`);
  if (c.rank) L.push(`신분: ${c.rank}`);
  if (c.crest) L.push(`문장: ${c.crest}`);
  if (c.base) L.push(`거점: ${c.base}`);
  const 상태 =
    c.life_status === 'deceased' ? '사망' : c.life_status === 'unknown' ? '생사 불명' : null;
  if (상태) L.push(`상태: ${상태}`);
  const 용모 = [
    c.height && `신장 ${c.height}`,
    c.build && `체격 ${c.build}`,
    c.hair && `모발 ${c.hair}`,
    c.iris && `홍채 ${c.iris}`,
    c.impression && `인상 ${c.impression}`,
  ]
    .filter(Boolean)
    .join(', ');
  if (용모) L.push(`용모: ${용모}`);
  if (c.personality) L.push(`성향: ${c.personality}`);
  if (c.combat) L.push(`전법: ${c.combat}`);
  if (c.notes) L.push(`비고: ${c.notes}`);
  return L.join('\n');
}

// 인연 한 줄의 생사 상태 라벨(사망/불명 여부는 분석에 영향을 준다).
const 인연상태 = (s) => (s === 'deceased' ? ' [사망]' : s === 'unknown' ? ' [생사 불명]' : '');

// 본인이 기록한 인연.
function 내인연문(c) {
  const bonds = Array.isArray(c.bonds) ? c.bonds.filter((b) => b && b.name) : [];
  if (!bonds.length) return '(기록된 인연 없음)';
  return bonds
    .map((b) =>
      `- ${b.name}${인연상태(b.status)}${b.category ? ` (${b.category})` : ''}: ${b.description || ''}`.trim(),
    )
    .join('\n');
}

// 타인의 명부에 이 인물이 어떻게 적혀 있는가(상호성 엔진 — 평판의 재료).
function 외부평판문(c, others) {
  const me = (c.name || '').trim();
  const lines = [];
  for (const o of others || []) {
    if (!o || o.id === c.id) continue;
    const bonds = Array.isArray(o.bonds) ? o.bonds : [];
    for (const b of bonds) {
      if (b?.name?.trim() === me) {
        lines.push(
          `- ${o.name}이(가) 본 나${인연상태(b.status)}: ${b.category || '관계'} — ${b.description || ''}`.trim(),
        );
      }
    }
  }
  return lines.length ? lines.join('\n') : '(타인의 명부에 기록된 정보 없음)';
}

const STAT_RULES = `
[능력치 채점 규칙 — "결함이 인물을 만든다"]
- 기준선: 50=평범한 병사/학생, 80=정예/전문가, 95+=역사적 전설, 30 이하=치명적 약점.
- 등가교환: 어떤 능력이 높으면(>80) 반드시 다른 능력이 낮아야(<40) 한다.
  * 무력이 높으면 → 마력/지성을 낮게.
  * 마력이 높으면 → 무력을 낮게.
  * 입지가 높으면(왕족/대귀족) → 정신(중압)이나 매력(오만)을 낮게 고려.
- 처지 반영: 도망자/추방자/포로라면 입지·재력은 0~20에 가깝게.
- 신앙(세이로스): 제국(아드라스테아)계는 보통 낮고(<30), 왕국(퍼거스)계는 보통 높다(>70).
- 목표: '완전한 육각형'(전부 높음)을 피하고, 약점이 도드라지는 들쭉날쭉한 프로필을 만든다.
- 입지 = 정치적 영향력과 신분·지위를 합친 축이다.

[항목별 한 줄 평]
- 각 능력에 25자 이내. 왜 높고 낮은지를 '문장'이 아니라 명사구로 압축한다 — 체언(명사)으로 끝맺고, 핵심어가 끝에 오게 한다. 서술형 어미(~하다/~한다/~된다)와 마침표는 쓰지 않는다.`;

const REPUTATION_RULES = `
[평판 — 대중의 정서 6종]
- 정확히 6개. 타인이 이 인물을 어떻게 '오해/평가'하는지.
- 먼저 최근 맥락에서 지배적 정서를 정한다. 카테고리를 억지로 고르게 분배하지 말 것 — 사건에 치우치는 게 자연스럽다.
- 출처(5개)는 이름 없는 인간 NPC. 형식 = [성격·상태 형용사] + [구체적 역할]. 형용사 없이 역할만 쓰면 실패(금지: '수도 경비병'·'병사' 같은 맨 역할). 1개는 비인간 의인화(동물/식물/사물).
  * 금지: 알파벳 이름('병사 A'), 알려진 등장인물(영주·유명 학생).
- 코멘트는 순수한 대사 또는 속마음만. [팩폭] 같은 태그를 문장 안에 넣지 말 것.
- 6개의 카테고리 종류는 뒤섞을 것(1→6 순서대로 내보내면 실패).
- 카테고리 정의:
  1. 황당한 착각: 특성을 엉뚱하게 오해.
  2. 악의적 음해: 근거 없는 악성 루머.
  3. 핑크빛 망상: 가짜 연애설·커플링.
  4. 맹목적 신격화: 결점마저 미덕으로 떠받드는 광신.
  5. 팩트 폭력: 정곡을 찌르는 아픈 진실.
  6. 대중 의견: 중립적·사실적 관찰.
- 최근 사건을 반드시 반영해 '갓 도는 소문'처럼.`;

// 분석 보고서 프롬프트(한국어 출력). 약력·맥락·인연·외부평판을 읽고 JSON으로.
export function buildReportPrompt(char, { context, customInstruction } = {}) {
  const 라벨 = STAT_KEYS.map(([k, ko]) => `${k}=${ko}`).join(', ');
  return `너는 포드라의 '왕실 분석관'이다. 인물 "${char.name}"의 분석 보고서를 발급하라.
약력(설정)을 최우선 근거로 삼고, 최근 본문 맥락·인연·타인의 시선을 더해 분석한다.
출력은 모두 자연스러운 한국어(올바른 띄어쓰기·문법)로 쓴다.

${customInstruction ? `[작가의 지시 — 최우선]\n"${customInstruction}"\n` : ''}
[약력]
${약력문(char)}
(중요: 게임 원작 설정보다 위 커스텀 약력을 우선한다.)

[내가 기록한 인연]
${내인연문(char)}

[타인의 시선 — 외부 평판의 재료]
${외부평판문(char, char.__others)}

[최근 맥락]
${context || '(아직 쌓인 본문이 없다 — 약력과 설정에 충실히 분석하라.)'}

${STAT_RULES}

[행동 양상 / 잠재 심리]
- personality(행동 양상): 약력의 〈성향〉을 그대로 옮겨 적지 말 것. 흩어진 성향을 하나의 패턴으로 종합하고, 그가 '어떻게·왜 그렇게 행동하는가'의 메커니즘을 짚는다. 본문 맥락이 있으면 행적에서 드러난 모습을 근거로. 3~5문장.
- unconscious(잠재 심리): 본인도 모르는 내면의 동기·상처·욕망을 3~5문장으로.

[대표 인용구]
- quote: 이 인물의 '현재' 심리·철학을 드러내는 짧고 강렬한 한 줄(40자 이내).
- 영화적·진중한 톤(독백/결의/냉소/통찰). 개그·반말 인사·메타 농담 금지.

${REPUTATION_RULES}

[해시태그]
- hashtags: 이 인물을 압축하는 한국어 해시태그 정확히 5개. '#' 없이 단어만.
- 오타쿠 팬덤 감성으로 쓴다 — 인물의 속성·트로프·모에 포인트·밈을 위트 있게 압축한다. 직업·소속의 단순 나열이 아니라 '캐릭터성'을 집어낸다.
- ⚠️ [약력]의 이명이나 위 분석 본문에 이미 나온 단어를 그대로 다시 쓰지 말 것 — 같은 말을 해시태그로 반복하는 건 무의미하다. 본문에 없는 '새로운 각도'로 본질을 포착한다.

[능력치 — 8종, 키=라벨]
${라벨}

[출력 JSON 구조] — 아래 키를 그대로, 설명·머리말 없이 JSON만:
{
  "quote": "대표 인용구",
  "hashtags": ["태그1","태그2","태그3","태그4","태그5"],
  "stats": { "prowess":50,"magic":50,"faith":50,"intellect":50,"standing":50,"wealth":50,"charm":50,"resilience":50 },
  "stat_comments": { "prowess":"한 줄 평","magic":"","faith":"","intellect":"","standing":"","wealth":"","charm":"","resilience":"" },
  "personality": "성격 분석",
  "unconscious": "무의식 분석",
  "reputation": [ { "source":"출처(형용사+처지)","comment":"대사 또는 속마음" } ]
}`;
}

// 이야기 맥락을 보고서 재료로 모은다 — 본문 생성과 같은 3겹(memory.mjs와 동일한 결):
//   ① 큰 줄기(거시 요약) + ② 큰 줄기에 아직 안 녹은 회차별 요약 + ③ 최근 본문 원문.
// ⚠️ 유저 프롬프트(작가 지시)는 넣지 않는다 — 오직 서술자 '본문(결과)'만(summarize.mjs와 동일 원칙).
// ⚠️ 읽기 전용 — 없는 회차 요약을 새로 '생성'하진 않는다(§9 모르는 새 API 폭주 방지).
//    그래서 요약이 비어 있어도 ③ 최근 본문으로 최신 맥락은 늘 확보된다.
async function 맥락모으기(storyId) {
  if (!storyId) return '';
  const [{ turns, hasSummaryCol }, { summary: arc, summaryTurnId }] = await Promise.all([
    loadTurnsForSummary(storyId),
    getStoryMemory(storyId),
  ]);
  if (!turns.length) return '';

  // 본문(서술자 결과)만 추린다 — 작가 지시(유저 입력)는 맥락에서 배제.
  const 본문들 = turns.filter((t) => t.role === 'assistant' && t.content?.trim());
  const cut = Math.max(0, 본문들.length - RECENT_RAW); // 최근 본문 창의 시작
  const arcThrough = summaryTurnId || 0; // 큰 줄기가 흡수한 지점

  // ② 최근 본문 밖 + 큰 줄기에도 안 녹은(=중복 아닌) 회차 요약만 시간순으로.
  //    긴 이야기 폭주 방지 — 가장 최근 SUMMARY_CAP개만(더 옛 흐름은 ① 큰 줄기가 담음).
  let 회차요약 = 본문들
    .slice(0, cut)
    .filter((t) => hasSummaryCol && t.summary?.trim() && (t.id ?? 0) > arcThrough)
    .map((t) => t.summary.trim());
  if (회차요약.length > SUMMARY_CAP) 회차요약 = 회차요약.slice(-SUMMARY_CAP);

  // ③ 최근 본문 원문.
  const 최근 = 본문들
    .slice(cut)
    .map((t) => `[본문]\n${t.content}`)
    .join('\n\n');

  return [
    arc && `[지금까지의 큰 줄기]\n${arc}`,
    회차요약.length && `[그동안의 회차 요약]\n${회차요약.join('\n\n')}`,
    최근 && `[최근 본문]\n${최근}`,
  ]
    .filter(Boolean)
    .join('\n\n');
}

// 발급 오케스트레이터 — 인물·외부평판·맥락을 모아 보고서를 짓고 DB에 새긴다.
//  엔드포인트(api/server)는 이 한 함수만 부른다.
export async function runReport({ characterId, storyId, customInstruction = '' } = {}) {
  if (!characterId) return { error: '인물 지목이 없습니다.' };
  const char = await getCharacter(characterId);
  if (!char) return { error: '인물을 찾을 수 없습니다.' };

  const sid = storyId || char.story_id || null;
  const [others, context] = await Promise.all([
    sid ? listCharacters(sid).then((r) => r.characters || []) : Promise.resolve([]),
    맥락모으기(sid),
  ]);

  const { report, error } = await generateReport(char, { others, context, customInstruction });
  if (error) return { error };

  const save = await setCharacterAnalysis(characterId, report);
  if (save.error) return { error: save.error };
  return { report };
}

// 보고서 발급 — 약력+맥락으로 Gemini를 불러 정규화된 보고서 객체를 돌려준다.
//  others: 같은 이야기의 다른 인물들(외부 평판용). context: 최근 줄거리/본문.
export async function generateReport(char, { others = [], context = '', customInstruction = '' } = {}) {
  const prompt = buildReportPrompt({ ...char, __others: others }, { context, customInstruction });
  const { data, error } = await callGeminiJSON(prompt);
  if (error) return { error };
  return { report: normalizeReport(data) };
}

// LLM 출력의 들쭉날쭉함을 다듬어 화면이 믿고 쓸 수 있는 모양으로 고정한다.
function normalizeReport(d) {
  const clampStat = (v) => {
    const n = Math.round(Number(v));
    return Number.isFinite(n) ? Math.max(0, Math.min(100, n)) : 50;
  };
  const stats = {};
  const stat_comments = {};
  for (const [k] of STAT_KEYS) {
    stats[k] = clampStat(d?.stats?.[k]);
    // 한 줄 평은 명사구 — AI가 붙인 끝 마침표는 기계적으로 제거.
    stat_comments[k] = String(d?.stat_comments?.[k] ?? '')
      .trim()
      .replace(/[.。．]+$/, '')
      .trim();
  }
  const hashtags = Array.isArray(d?.hashtags)
    ? d.hashtags.map((t) => String(t).replace(/^#/, '').trim()).filter(Boolean).slice(0, 5)
    : [];
  const reputation = Array.isArray(d?.reputation)
    ? d.reputation
        .map((r) => ({ source: String(r?.source ?? '').trim(), comment: String(r?.comment ?? '').trim() }))
        .filter((r) => r.source || r.comment)
        .slice(0, 6)
    : [];
  return {
    quote: String(d?.quote ?? '').trim(),
    hashtags,
    stats,
    stat_comments,
    personality: String(d?.personality ?? '').trim(),
    unconscious: String(d?.unconscious ?? '').trim(),
    reputation,
    generated_at: new Date().toISOString(),
  };
}
