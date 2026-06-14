// ─────────────────────────────────────────────────────────────────────────
//  일지(日誌) 발급소 — Gemini Flash가 인물 '본인'이 그날의 끝에서 적는 일지를 짓는다.
//
//  서신(letters.mjs)의 '안쪽 짝'이다 — 서신=남에게/밖으로, 일지=자신에게/안으로.
//  legacy에 일기가 있었으나 운영난(날짜 누설·본문 중계형·소일상 혼합 통제)으로 폐기 →
//  이 설계는 그 세 적을 교정한 것. 상세 도면 = docs/일지_설계.md.
//
//  핵심:
//   · 단위 = '지난번 펜을 든 뒤' 한 자락. 절대 날짜(○일)를 안 박는다(상대 시간어만) →
//     16·18·미래 날짜가 섞이는 모순이 구조적으로 발생 불가(legacy가 몇 시간 데인 지점).
//   · 입력 경계 = 포인터(journals_cursor) 이후의 새 회차만, 상한까지만 먹인다 →
//     '안 먹인 것은 안 샌다'(서신 §0). 같은 경계가 사건 중복까지 막는다.
//   · 하루 = 소일상이 본체 + 마음에 남은 한 점(메인). 무대 밖 인물은 순수 소일상.
//   · 분위기로만 — 고정 인물·일과를 박제하지 않는다(누적 정합 부담 0).
//
//  저장 = characters.analysis(jsonb)의 journals 칸 — 임무·소지품과 같은 결, 스키마 변경 없음.
//  ⚠️ SYSTEM(박제 세계관)은 안 넣는다(CLAUDE.md §3). 단 NAMES(표기 명단)+물질문화 금지 몇 줄은
//     서신·임무와 같은 승인 예외(일지 한정 — 호칭 체계는 뺀다, 받는 이가 없어 경칭이 무의미).
// ─────────────────────────────────────────────────────────────────────────

import { getCharacter, setCharacterAnalysis, loadTurnsForSummary, getGuidance } from './db.mjs';
import { callGeminiJSON, 약력문 } from './report.mjs';
import { buildGuidanceBlock } from './guidance.mjs';
import { NAMES } from './worldview.mjs';

const JOURNAL_RAW = 6; // 한 자락이 덮는 최근 본문 화 수 상한 — 입력 경계(누설·폭주 방지)
const RECENT_REF = 3; // 반복 방지로 들춰 보는 최근 일지 수(네거티브 신호)

// 본문 클리너 — 개행(문단)은 보존하고 가로 공백만 접는다(서신 본문정리와 같은 결).
//  ⚠️ \s{2,} 일괄 치환은 빈 줄을 뭉개 문단을 붙여 버린다 — 가로 공백·세로 빈 줄을 따로 다룬다.
function 본문정리(s) {
  return String(s ?? '')
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// 포인터 이후의 '새 회차'만 모아 한 자락의 입력을 짓는다.
//  돌려주는 lastTurnId로 포인터를 전진시킨다(다음 일지는 그 뒤만 본다 → 중복·누설 차단).
//  noNew=true → 지난번 이후 흐른 본문이 없음(빈손 차단 판단에 씀).
async function 일지맥락(storyId, cursor = 0) {
  if (!storyId) return { context: '', lastTurnId: cursor, noNew: true };
  const { turns } = await loadTurnsForSummary(storyId);
  // 본문(서술자 결과)만 — 작가 지시(유저 입력)는 일지 재료에서 배제(보고서·요약과 같은 원칙).
  const 본문들 = (turns || []).filter((t) => t.role === 'assistant' && t.content?.trim());
  if (!본문들.length) return { context: '', lastTurnId: cursor, noNew: true };
  const lastTurnId = 본문들[본문들.length - 1].id ?? cursor;
  const 새것 = 본문들.filter((t) => (t.id ?? 0) > (cursor || 0));
  if (!새것.length) return { context: '', lastTurnId, noNew: true };
  const context = 새것
    .slice(-JOURNAL_RAW)
    .map((t) => `[본문]\n${t.content}`)
    .join('\n\n');
  return { context, lastTurnId, noNew: false };
}

// 일지 프롬프트(한국어 출력·1인칭). 약력·한 자락 맥락·지난 일지(네거티브)·지침을 읽고 JSON으로.
//  few-shot 금지(§3) — 규칙·금지·어조 묘사로만 유도한다.
export function buildJournalPrompt(char, { context, recent = [], guidance = '' } = {}) {
  const 무대 = context && context.trim();
  const 지난 = recent.length
    ? `[지난 일지 — 이미 적은 것]\n${recent
        .map((e) => `· ${e.title ? `"${e.title}" — ` : ''}${(e.body || '').replace(/\s+/g, ' ').slice(0, 120)}…`)
        .join('\n')}\n(결은 잇되 같은 말을 되풀이하지 마라 — 같은 마음·같은 일상이라도 오늘은 다른 결로. 위에 이미 적은 일·문장을 다시 옮기면 실패다. 위 일지는 '지키라'고 주는 게 아니라 '겹치지 말라'고 주는 것이다.)\n\n`
    : '';
  const 지침 = guidance ? buildGuidanceBlock(guidance) + '\n\n' : '';

  return `너는 포드라의 인물 "${char.name}" 본인이다. 하루의 끝에서, 아무에게도 보이지 않을 너만의 일지를 한 자락 적는다.
출력은 모두 자연스러운 한국어(올바른 띄어쓰기·문법)로 쓴다.

[나는 누구인가 — 약력]
${약력문(char)}
(게임 원작 설정보다 위 커스텀 약력을 우선한다.)

[요즘 세상에 흐른 일들${무대 ? '' : ' — 아직 적을 만한 큰일은 지나가지 않았다'}]
${무대 ? context : '(특별한 사건은 없었다. 그저 여느 날의 하루를 적는다.)'}
- 위는 요즘 세상에 흐른 일들이다. 그러나 일지에 적을 수 있는 건 네가 그 자리에 직접 있었던 일뿐이다.
- 네가 없던 자리의 일은 너로선 모르는 일이니 적지 마라(엿보지도, 짐작으로 옮기지도 말 것).
- 네가 끼어들 무대가 없던 날이라면, 그 사이 너의 하루는 그저 조용한 소일상이었다 — 그것을 적으면 된다.

${지난}[고유명사 표기 — 이 철자만 따른다]
${NAMES.join(', ')}

[이 세계의 결 — 어기면 안 되는 것]
- 물질문화는 서양 중세다. 붓·먹·벼루 같은 동양 문방구가 아니라 깃펜·잉크병으로 쓴다(단 비서구 문화권의 인물·장면이라면 그 결을 따른다).
- 신앙·기도의 대상은 '여신'이다. '하느님·주님' 금지. 게임 용어(레벨·경험치·스킬·턴 등)·메타 표현 금지.

${지침}[일지를 적는 법]
- 1인칭. 하루의 끝에서 돌아보는 글이라 과거시제가 기본이다. 다만 지금 이 순간의 감정은 현재형으로("아직도 가슴이 답답하다"), 다짐은 미래형으로 새어 나와도 좋다.
- 사건을 일어난 순서대로 중계하지 마라(시점만 바꾼 본문 재생은 실패다). 일지는 사건의 재생이 아니라, 하루가 끝난 뒤 마음에 남은 것을 되새기는 글이다.
- 소일상이 본체다. 아침에 무엇을 먹었는지, 어떤 소임을 보았는지, 누구와 스쳤는지 — 너의 신분·거점·지금 처지가 그 하루를 정한다(수도원의 기사라면 훈련과 순찰, 영애라면 서신과 자수, 갇힌 몸이라면 차가운 감방). 세상의 큰일은 그 하루 안에 '마음에 걸린 한 점'으로만 박힌다.
- 소일상은 그날의 질감일 뿐이다 — 단골 요리사·고정된 일과를 박제하듯 못 박지 말고, 오늘 하루의 한 조각만 가볍게 스친다.
- 시간은 '요 며칠'·'그 밤이 지나고'처럼 상대적으로만 적는다. 제국력·날짜 숫자(○일)는 절대 적지 마라.
- 아무에게도 보이지 않을 글이다 — 남에게 설명하거나 보고하는 투 금지. 너만 아는 약칭·생략이 묻어나도 좋다.
- 제목은 '문학적 표제'가 아니다. 너는 작가가 아니라 일기를 적는 당사자다 — 시적 비유나 관조하는 수식(예: "고요 속에 스민 그림자" 같은 류)은 금지. 그날 손 가는 대로 적은 무심한 한 마디(그날의 한 조각·무던한 기분·짧은 푸념·맨 먼저 떠오른 말)면 된다. 꾸미지 말고 짧게, 일상어로.
- 분량은 하루의 한 호흡(서너 문단 안팎). 길어지면 사건을 너무 담은 것이다 — 마음에 남은 것만.

[출력 JSON 구조] — 아래 키를 그대로, 설명·머리말 없이 JSON만:
{ "title": "그날 손 가는 대로 적은 무심한 한 마디(문학적 표제 아님·12자 이내·날짜 숫자 금지)", "body": "일지 본문(문단 사이는 빈 줄로 띄운다)" }`;
}

// LLM 출력을 화면이 믿고 쓸 모양으로 고정한다.
function normalizeJournal(d) {
  const title = String(d?.title ?? '')
    .replace(/[[\]【】\n\r]/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim()
    .slice(0, 40);
  const body = 본문정리(d?.body);
  return { title, body };
}

// 안정 id(소각·식별용) — 서버가 발급(BelongingItem과 같은 결, 문자열).
const newId = () => 'j' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

// 발급 오케스트레이터 — 인물·한 자락 맥락을 모아 일지를 짓고 analysis.journals에 누적한다.
//  엔드포인트(api/server)는 이 한 함수만 부른다.
export async function runJournal({ characterId, storyId } = {}) {
  if (!characterId) return { error: '인물 지목이 없습니다.' };
  const char = await getCharacter(characterId);
  if (!char) return { error: '인물을 찾을 수 없습니다.' };
  // 사망만이 게이트 — 죽은 자는 더 일지를 적지 못한다(서신의 유서 같은 사후 예외는 없다).
  //  구금·잠든 인물은 허용(받는 이가 없어 자격 시비가 사라진다 — 옥중 일기·무대 밖 소일상).
  if (char.life_status === 'deceased')
    return { error: '세상을 떠난 이는 더 일지를 적지 못합니다.' };

  const sid = storyId || char.story_id || null;
  const prev = char.analysis || {};
  const journals = Array.isArray(prev.journals) ? prev.journals : [];
  const cursor = Number(prev.journals_cursor) || 0;

  const { context, lastTurnId, noNew } = await 일지맥락(sid, cursor);
  // 진척이 없는데 이미 적어둔 일지가 있으면 빈손 새로고침 차단(소지품 '못 찾음'과 같은 결).
  //  첫 일지(아직 한 장도 없음)는 본문이 없어도 허용 → 약력 기반 순수 소일상 한 장.
  if (noNew && journals.length)
    return { error: '아직 새로 적을 거리가 무르익지 않았습니다 — 이야기가 더 흐른 뒤에 펼치십시오.' };

  const guidance = sid ? await getGuidance(sid) : '';
  const prompt = buildJournalPrompt(char, {
    context,
    recent: journals.slice(0, RECENT_REF),
    guidance,
  });

  // 일지는 짧은 산문 한 장 — thinking 짧게, 출력 한도는 본문 담을 만큼.
  const { data, error } = await callGeminiJSON(prompt, {
    temperature: 0.9,
    maxOutputTokens: 4000,
    thinkingBudget: 512,
    tag: '일지',
  });
  if (error) return { error };

  const entry = normalizeJournal(data);
  if (!entry.body) return { error: '일지를 한 줄도 받지 못했습니다 — 다시 시도하십시오.' };
  entry.id = newId();
  entry.created_at = new Date().toISOString();

  // 보고서·임무·소지품 등 기존 analysis 살림은 그대로, journals 칸만 갱신(최신이 위).
  const merged = {
    ...prev,
    journals: [entry, ...journals],
    journals_at: entry.created_at,
    journals_cursor: lastTurnId, // 여기까지 덮음 — 다음 일지는 이 뒤만 본다
  };
  const save = await setCharacterAnalysis(characterId, merged);
  if (save.error) return { error: save.error };
  return { report: merged };
}

// 일지 한 장 편집 — 제목·본문을 고쳐 쓴다(포인터·시각·id는 그대로). 뷰/편집 분리 원칙.
export async function updateJournal({ characterId, entryId, title, body } = {}) {
  if (!characterId || !entryId) return { error: '지목이 없습니다.' };
  const char = await getCharacter(characterId);
  if (!char) return { error: '인물을 찾을 수 없습니다.' };
  const existing = Array.isArray(char.analysis?.journals) ? char.analysis.journals : [];
  let found = false;
  const next = existing.map((e) => {
    if (e?.id !== entryId) return e;
    found = true;
    return {
      ...e,
      title: title !== undefined ? String(title).replace(/[\n\r]/g, ' ').trim().slice(0, 40) : e.title,
      body: body !== undefined ? 본문정리(body) : e.body,
    };
  });
  if (!found) return { error: '그 일지를 찾을 수 없습니다.' };
  const merged = { ...(char.analysis || {}), journals: next };
  const save = await setCharacterAnalysis(characterId, merged);
  if (save.error) return { error: save.error };
  return { report: merged };
}

// 일지 한 장 소각 — 포인터(journals_cursor)는 건드리지 않는다(지운 날을 다시 쓰진 않는다).
export async function removeJournal({ characterId, entryId } = {}) {
  if (!characterId || !entryId) return { error: '지목이 없습니다.' };
  const char = await getCharacter(characterId);
  if (!char) return { error: '인물을 찾을 수 없습니다.' };
  const existing = Array.isArray(char.analysis?.journals) ? char.analysis.journals : [];
  const next = existing.filter((e) => e?.id !== entryId);
  if (next.length === existing.length) return { error: '그 일지를 찾을 수 없습니다.' };
  const merged = { ...(char.analysis || {}), journals: next };
  const save = await setCharacterAnalysis(characterId, merged);
  if (save.error) return { error: save.error };
  return { report: merged };
}
