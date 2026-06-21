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
import { callGemini } from './gemini.mjs';

const RECENT_RAW = 8; // 보고서 맥락에 원문으로 넣을 최근 '본문(서술자)' 화 수
const SUMMARY_CAP = 12; // 회차 요약은 가장 최근 이만큼만(그 이전 흐름은 큰 줄기가 담음) — 폭주 방지

// 능력치 9종 — 키(영문)·라벨(한글). 권세(영향력)+위상(신분)은 '입지'로 합쳤다.
//  기반 3축 = 입지·재력·명망(보고서에 표시). 나머지 6각은 일상(日常)으로 이사 예정.
export const STAT_KEYS = [
  ['prowess', '무력'],
  ['magic', '마력'],
  ['faith', '신앙'],
  ['intellect', '지성'],
  ['standing', '입지'],
  ['wealth', '재력'],
  ['renown', '명망'],
  ['charm', '매력'],
  ['resilience', '정신'],
];

// Gemini에 JSON 한 덩이를 요청해 파싱한다 — 호출·재시도·타임아웃·차단기는 공용 클라이언트(gemini.mjs)가,
//  여기선 JSON 파싱만 한다. 보고서는 '창작+추론'이라 thinking을 켜되 예산 한정 + maxOutputTokens 넉넉히(잘림 방지).
//  (임무 장부(quests.mjs)도 같이 쓴다 — export)
export async function callGeminiJSON(
  prompt,
  { temperature = 0.85, maxOutputTokens = 10000, thinkingBudget = 2048, tag = '보고서' } = {},
) {
  const { text, finish, error } = await callGemini(prompt, {
    temperature,
    maxOutputTokens,
    thinkingBudget,
    json: true,
    tag,
  });
  if (!text) {
    if (finish === 'MAX_TOKENS') return { error: '응답이 토큰 한도에서 잘렸습니다 — 다시 시도하십시오.' };
    if (finish === 'SAFETY') return { error: 'Gemini 안전 필터에 걸렸습니다.' };
    return { error: error || '빈 응답' };
  }
  try {
    return { data: JSON.parse(text) };
  } catch {
    // 코드펜스/잡텍스트가 섞이면 첫 { … 마지막 } 만 떼어 재시도.
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
}

// 인물 한 명의 약력을 프롬프트용 텍스트로 펼친다(보고서는 단건이라 전부 넣는다).
//  (임무 장부(quests.mjs)도 같이 쓴다 — export)
export function 약력문(c) {
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
- 명망 = 그 이름이 세상에 닿는 범위·무게로, 공식 지위(입지)와 별개다. 무명·은둔이면 낮고, 떠도는 영웅처럼 지위는 낮아도 위명이 자자할 수 있으며, 전설적 인물은 95+다.

[항목별 한 줄 평]
- 각 능력에 짧은 명사구 하나(쉼표로 두 구를 잇지 말 것). 좁은 칸에 인라인으로 들어가니 공백 포함 12~16자로, 그리고 세 항목의 길이가 들쭉날쭉하지 않게 비슷한 밀도로 맞춘다.
- 한 단어짜리 호칭·별명만 달랑 두지 말고 수식을 붙여 명사구로 만든다. 16자를 넘기지 말 것(넘으면 화면에서 잘린다).
- 체언(명사)으로 끝맺고 핵심어를 끝에 둔다. 서술형 어미(~하다/~한다/~된다)·마침표·쉼표는 쓰지 않는다.`;

const REPUTATION_RULES = `
[평판 — 대중의 정서 6종]
- 정확히 6개. 타인이 이 인물을 어떻게 '오해/평가'하는지.
- 먼저 최근 맥락에서 지배적 정서를 정한다. 카테고리를 억지로 고르게 분배하지 말 것 — 사건에 치우치는 게 자연스럽다.
- ⚠️ 공개된 것만 소문이 된다: 평판은 '바깥에 알려졌거나 알려질 법한' 면모·처지에서 나온다. 밀실·단둘·은밀한 장면처럼 남이 보지 못한 사건은, 목격·누설 경로가 분명하지 않으면 소문으로 삼지 말 것(사적인 일을 대중이 다 아는 것처럼 쓰지 않는다).
- 출처(5개)는 이름 없는 인간 NPC. 형식 = [성격·상태 형용사] + [구체적 역할]. 형용사 없이 역할만 쓰면 실패(금지: '수도 경비병'·'병사' 같은 맨 역할). 1개는 비인간 의인화(동물/식물/사물).
  * 금지: 알파벳 이름('병사 A'), 알려진 등장인물(영주·유명 학생).
- ⚠️ 출처가 대상을 부르거나 가리키는 말은 '그 출처와 대상의 거리 + 대상의 신분'에 맞춘다. 익명의 대중은 대상과 멀다 — 친밀하거나 특정인만 쓸 호칭을 모든 출처가 두루 쓰게 하지 말 것. 신분(죄수·포로·왕·평민…)에 맞는 지칭으로, 출처마다 다르게(같은 호칭을 돌려쓰면 실패).
- 코멘트는 순수한 대사 또는 속마음만. [팩폭] 같은 태그를 문장 안에 넣지 말 것.
- 6개의 카테고리 종류는 뒤섞을 것(1→6 순서대로 내보내면 실패).
- 카테고리 정의:
  1. 황당한 착각: 특성을 엉뚱하게 오해.
  2. 악의적 음해: 근거 없는 악성 루머.
  3. 핑크빛 망상: 가짜 연애설·커플링.
  4. 맹목적 신격화: 결점마저 미덕으로 떠받드는 광신.
  5. 팩트 폭력: 정곡을 찌르는 아픈 진실.
  6. 대중 의견: 중립적·사실적 관찰.
- 현실을 통째로 뒤집는 곡해(유능하게 처리한 국정을 '마비됐다' 따위)는 기껏해야 '악의적 음해/황당한 착각' 한둘로만 쓰고, 명백히 '한 사람의 곡해·악감정'으로 드러나게 한다. 6종 다수가 같은 거짓을 사실인 양 합창하면 실패다(평판은 다양한 시선의 모음이지 한 가지 누명이 아니다).
- 최근 사건 중 '바깥에 드러난' 것을 반영해 '갓 도는 소문'처럼(은밀한 일은 위 공개 원칙을 따른다).`;

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

[맥락을 곧이곧대로 — 결을 뒤집거나 한 장면으로 인물을 깎지 말 것]
- 본문에 적힌 사건의 '결(유능/무능·헌신/태만·성공/실패)'을 임의로 뒤집지 않는다. 본문이 빠르고 유능하게 처리했다고 적었으면 그것을 '소홀·마비·무관심'으로 바꿔 읽지 말 것.
- 동기가 사적이어도(누굴 보러 가려 서둘러도) 결과가 유능·신속이면 그대로 인정한다. '사적 동기 = 직무 유기'라는 트로프를 씌우지 말 것. '급하지 않은 일을 미룸' ≠ '국정 마비' — 정도를 부풀리지 않는다.
- 그동안 본문·약력이 쌓아 온 그의 헌신·고뇌·책임을 한 화의 가벼운 장면으로 통째 부정하지 않는다. 전체 궤적 위에서 '지금'을 읽는다.

${STAT_RULES}

[행동 양상 / 잠재 심리]
- 이 둘은 인물의 '지금'을 읽되, '지금'은 약력·큰 줄기가 쌓아 온 사람 위에서 일어난다 — 둘을 통합한다(최근 맥락 = 지금 무엇이 부각됐나 / 약력·큰 줄기 = 그가 본래 누구이고 무엇에 헌신·갈등해 왔나). 최근 한 화의 표면적 장면이 그 지속적 본질(헌신·신념·고뇌)을 지워 버리게 두지 않는다. 약력만 앵무새처럼 반복해도 실패, 최근 한 화에 인물 전체를 욱여넣어도 실패다.
- personality(행동 양상): 겉으로 드러나는 것만 — 타인이 관찰할 수 있는 행동·태도·결정. 약력 〈성향〉을 그대로 옮기지 말고, 최근 본문의 행적에서 '지금 어떻게 행동하는가'의 메커니즘을 짚는다. 속내·무의식은 여기 쓰지 말고 잠재 심리에 넘긴다. 3~5문장.
- unconscious(잠재 심리): 겉 행동의 묘사는 피하고, 본인도 모르는 '속'만 — 내면의 동기·상처·욕망을, 최근 국면이 건드리거나 새로 드러낸 지점을 중심으로 3~5문장.
- ⚠️ 세 항목(기반·행동 양상·잠재 심리)은 서로의 영역을 침범하지 않는다. 같은 사건을 말하더라도 층위가 달라야 한다 — 기반=세상에서의 위치, 행동 양상=겉으로 보이는 행동, 잠재 심리=본인도 못 보는 속. 같은 말을 층만 바꿔 되풀이하면 실패다.
- 둘 다 '그는·그녀는·인물 이름' 같은 주어로 시작하거나 되풀이하지 말고 바로 서술한다.

[대표 인용구]
- quote: 이 인물의 '현재' 심리·철학을 드러내는 짧고 강렬한 한 줄(40자 이내).
- 영화적·진중한 톤(독백/결의/냉소/통찰). 개그·반말 인사·메타 농담 금지.
- 새로 빚는다(중요): 주어진 글(본문·줄거리·작가 지시 등)에 이미 있는 문장을 그대로 따오거나 살짝 손질해 쓰지 않는다. 본문 한 줄을 복사하면 실패다 — 인물의 본질을 네가 새로 벼려 낸 한 줄이어야 한다.

${REPUTATION_RULES}

[해시태그]
- hashtags: 이 인물을 압축하는 한국어 해시태그 정확히 5개. '#' 없이 단어만.
- 오타쿠 팬덤 감성으로 쓴다 — 인물의 속성·트로프·모에 포인트·밈을 위트 있게 압축한다. 직업·소속의 단순 나열이 아니라 '캐릭터성'을 집어낸다.
- ⚠️ [약력]의 이명이나 위 분석 본문에 이미 나온 단어를 그대로 다시 쓰지 말 것 — 같은 말을 해시태그로 반복하는 건 무의미하다. 본문에 없는 '새로운 각도'로 본질을 포착한다.

[능력치 — 8종, 키=라벨]
${라벨}

[기반 종합]
- foundation: 입지·재력·명망 세 축을 '아울러' 이 인물이 세상에서 차지한 '위치'를 3~4문장으로 그린다. 지금 국면(최근 본문)에서 그 위치가 어떻게 놓여 있는지를 우선한다.
- ⚠️ 막대가 이미 보여준 것(입지·재력·명망이 높다/낮다)을 산문으로 되풀이하지 말 것. 줄글은 막대가 못 담는 '구조'를 더한다 — 누구를 거느리고 누구·무엇에 매이는지(상하·동맹·교단·타국), 어떤 의무와 제약을 지는지, 그 위치가 지금 어떻게 쓰이고 시험받는지. 약력·본문에서 확인되는 구체로만.
- ⚠️ 감정·고뇌·집착 같은 '내면'은 여기 쓰지 않는다(행동 양상·잠재 심리 소관). '높은 자리는 으레 외롭다/무겁다' 식의 클리셰·일반론으로 채우거나 처지를 멋대로 추측하지 말 것.
- 재료가 적으면 억지로 늘리지 말고 짧고 단단하게. 수치 나열·미사여구·예언 없이 담담히.

[출력 JSON 구조] — 아래 키를 그대로, 설명·머리말 없이 JSON만:
{
  "quote": "대표 인용구",
  "hashtags": ["태그1","태그2","태그3","태그4","태그5"],
  "stats": { "prowess":50,"magic":50,"faith":50,"intellect":50,"standing":50,"wealth":50,"renown":50,"charm":50,"resilience":50 },
  "stat_comments": { "prowess":"한 줄 평","magic":"","faith":"","intellect":"","standing":"","wealth":"","renown":"","charm":"","resilience":"" },
  "foundation": "입지·재력을 아우른 처지 서너 문장",
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
//  (임무 장부(quests.mjs)도 같이 쓴다 — export)
export async function 맥락모으기(storyId) {
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

  // 임무(quests)·소지품(belongings)·일지(journals)·일상(daily)은 따로 살림 — 보고서 재작성이 덮어쓰지 않게 보존한다.
  const prev = char.analysis || {};
  const 살림 = {};
  for (const k of [
    'quests', 'quests_at',
    'belongings', 'belongings_at',
    'journals', 'journals_at', // 포인터는 entry.through에 들어 있어 journals만 지키면 따라온다
    'daily', // 일상 서랍 통째(능력·경제·상태·관계·정사…) — 보고서와 무관하게 보존
  ])
    if (prev[k] !== undefined) 살림[k] = prev[k];
  const merged = { ...report, ...살림 };

  const save = await setCharacterAnalysis(characterId, merged);
  if (save.error) return { error: save.error };
  return { report: merged };
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
    // 한 줄 평은 명사구 하나 — 쉼표로 두 구를 이으면 첫 구만, 끝 마침표는 제거(기계 보정).
    stat_comments[k] = String(d?.stat_comments?.[k] ?? '')
      .split(/[,，]/)[0]
      .trim()
      .replace(/[.。．]+$/, '')
      .trim();
  }
  const hashtags = Array.isArray(d?.hashtags)
    ? d.hashtags.map((t) => String(t).replace(/^#/, '').trim()).filter(Boolean).slice(0, 5)
    : [];
  // 출처·코멘트에 새는 괄호류 태그([], 【】, 「」 등)를 기계적으로 제거.
  const 괄호제거 = (s) =>
    String(s ?? '')
      .replace(/[[\]【】「」『』〔〕〈〉《》<>＜＞]/g, '')
      .replace(/\s{2,}/g, ' ')
      .trim();
  const reputation = Array.isArray(d?.reputation)
    ? d.reputation
        .map((r) => ({ source: 괄호제거(r?.source), comment: 괄호제거(r?.comment) }))
        .filter((r) => r.source || r.comment)
        .slice(0, 6)
    : [];
  return {
    quote: String(d?.quote ?? '').trim(),
    hashtags,
    stats,
    stat_comments,
    foundation: String(d?.foundation ?? '').trim(), // 입지·재력 종합(기반 줄글)
    personality: String(d?.personality ?? '').trim(),
    unconscious: String(d?.unconscious ?? '').trim(),
    reputation,
    generated_at: new Date().toISOString(),
  };
}
