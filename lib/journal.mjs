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
//   · 입력 경계 = 포인터 이후의 새 회차만, 상한까지만. '안 먹인 것은 안 샌다'(서신 §0).
//   · ⚠️ 본문 산문을 일지에 직접 안 먹인다 — 먼저 Flash로 압축하고(2콜) 일지는 그 요지로만 쓴다
//     (서신의 판별/생성 분리와 같은 결). 산문을 못 보면 베낄(재연) 수 없다.
//   · ⚠️ 압축은 '날 인식(day-aware)' — 서사의 시간 단절(잠/이튿날/며칠 뒤)로 '가장 마지막 하루'만
//     골라낸다. 하루가 여러 화에 걸쳐도 한 일지로(토막 안 냄), 여러 날이 한 일지에 안 섞이게.
//     화 개수가 아니라 '날 경계'로 하루를 가른다 — legacy가 못 푼 핵심. 단 절대 날짜는 안 박음(상대 묶음).
//   · 하루 = 소소한 일상이 바탕, 큰일은 재연이 아니라 되새김으로(비율은 그날 상황에 맡긴다).
//   · 분위기로만 — 고정 인물·일과를 박제하지 않는다(누적 정합 부담 0).
//
//  저장 = characters.analysis(jsonb)의 journals 칸 — 임무·소지품과 같은 결, 스키마 변경 없음.
//  ⚠️ SYSTEM(박제 세계관)은 안 넣는다(CLAUDE.md §3). 단 NAMES(표기 명단)+물질문화 금지 몇 줄은
//     서신·임무와 같은 승인 예외(일지 한정 — 호칭 체계는 뺀다, 받는 이가 없어 경칭이 무의미).
// ─────────────────────────────────────────────────────────────────────────

import { getCharacter, setCharacterAnalysis, loadTurnsForSummary, getGuidance } from './db.mjs';
import { callGeminiJSON, 약력문 } from './report.mjs';
import { callGemini } from './gemini.mjs';
import { buildGuidanceBlock } from './guidance.mjs';
import { NAMES } from './worldview.mjs';

const JOURNAL_RAW = 5; // 최근 회차 묶음(이 안에서 압축이 '가장 마지막 하루'만 골라낸다 — 하루가 여러 화에 걸쳐도 한 일지로)
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

// 최근 회차 묶음에서 '가장 마지막 하루'의 잔여물 — 그날 인물의 마음에 가장 무겁게 남은 한 가지 —
//  만 한두 문장으로 짚는다(Flash 1콜). ⚠️ 5줄 사실 요지를 주면 일지가 그걸 재탕한다(A사이드).
//  잔여물(한두 문장)만 주면 재탕할 재료가 없어 일지가 무대 밖 일상(B사이드)으로 빈자리를 채운다(§0).
//  '날 인식'으로 마지막 하루만(여러 날 안 섞임), POV 한정이라 §5 누설도 흡수. 절대 날짜는 안 박음.
async function 일지요지(context, char) {
  if (!context) return '';
  const prompt = `다음은 "${char.name}"의 이야기에서 최근 이어진 회차들이다(시간순). '가장 마지막 하루'에 그가 직접 겪은 일 가운데, 그날 그의 마음에 가장 무겁게 남았을 한 가지만 한두 문장으로 짧게 짚어라.
- '가장 마지막 하루' = 마지막으로 날이 바뀐 지점(잠/이튿날/며칠 뒤 같은 시간의 단절) 이후. 그 이전 날의 일은 빼라.
- 장면·대사·줄거리를 옮기지 말고 '무엇이 그의 마음을 움직였나'만 사실로 짚는다(누구의 어떤 말·행동, 혹은 그가 내린 어떤 결정 — 한두 가지). 풀어 설명하지 말고 짧게.
- 햇수·기간·내력은 기록에 적힌 것만 쓰고, 서로 다른 일을 뭉뚱그리지 마라. 없으면 적지 마라.
- 그가 현장에서 직접 겪은 일이 아니면 빼라. 마음에 남을 만한 일이 없으면 빈칸으로 둔다.

[회차들 — 시간순]
${context}`;
  const { text } = await callGemini(prompt, {
    temperature: 0.3,
    maxOutputTokens: 256,
    thinkingBudget: 0,
    tag: '일지요지',
  });
  return (text || '').trim();
}

// 일지 프롬프트(한국어 출력·1인칭). 약력·한 자락 맥락·지난 일지(네거티브)·지침을 읽고 JSON으로.
//  few-shot 금지(§3) — 규칙·금지·어조 묘사로만 유도한다.
export function buildJournalPrompt(char, { 요지, recent = [], guidance = '' } = {}) {
  const 있음 = 요지 && 요지.trim();
  const 지난 = recent.length
    ? `[지난 일지 — 이미 적은 것]\n${recent
        .map((e) => `· ${e.title ? `"${e.title}" — ` : ''}${(e.body || '').replace(/\s+/g, ' ').slice(0, 120)}…`)
        .join('\n')}\n(결은 잇되 같은 말을 되풀이하지 마라 — 같은 마음·같은 일상이라도 오늘은 다른 결로. 위에 이미 적은 일·문장을 다시 옮기면 실패다. 위 일지는 '지키라'고 주는 게 아니라 '겹치지 말라'고 주는 것이다.)\n\n`
    : '';
  const 지침 = guidance ? buildGuidanceBlock(guidance) + '\n\n' : '';

  return `너는 포드라의 인물 "${char.name}" 본인이다. 오늘 하루를 돌아보며, 아무에게도 보이지 않을 너만의 일지를 한 자락 적는다.
출력은 모두 자연스러운 한국어(올바른 띄어쓰기·문법)로 쓴다.

[나는 누구인가 — 약력]
${약력문(char)}
(게임 원작 설정보다 위 커스텀 약력을 우선한다.)

[오늘 네 마음에 남은 한 가지 — 그날의 무게${있음 ? '' : ' (이렇다 할 일은 없었다)'}]
${있음 ? 요지 : '(특별한 일은 없었다. 그저 여느 날의 하루를 적는다.)'}
- 위는 오늘 네 마음에 가장 무겁게 남은 한 가지다 — 사건을 풀어 늘어놓으라는 게 아니라, 이 '무게'를 알고 쓰라는 것이다. 그 전말·장면·대화를 옮기면 실패(본문 복기)다. 이건 글 밑에 깔린 무게일 뿐, 글의 대부분은 아래대로 무대 밖 일상이 채운다.
- 사실을 지어내지 마라(가장 중요). 네 마음·느낌은 네 것이니 마음껏 적되, **햇수·기간·지난 내력·남이 왜 그랬는지 같은 '바깥의 사실'은 위 요지와 약력에 있는 것만** 쓴다. 요지에 없는 숫자·내력·동기를 만들어 채우면 실패다. 서로 다른 일(오랜 일과 최근 일)을 한데 뭉뚱그리지 마라. 확실치 않은 것은 단정하지 말고 모르는 채로 적어라("어째서였을까", "아마도").

${지난}[고유명사 표기 — 이 철자만 따른다]
${NAMES.join(', ')}

[이 세계의 결 — 어기면 안 되는 것]
- 물질문화는 서양 중세다. 붓·먹·벼루 같은 동양 문방구가 아니라 깃펜·잉크병으로 쓴다(단 비서구 문화권의 인물·장면이라면 그 결을 따른다).
- 신앙·기도의 대상은 '여신'이다. '하느님·주님' 금지. 게임 용어(레벨·경험치·스킬·턴 등)·메타 표현 금지.

${지침}[일지를 적는 법]
- 1인칭. 하루의 끝에서 돌아보는 글이라 과거시제가 기본이다. 다만 지금 이 순간의 감정은 현재형으로("아직도 가슴이 답답하다"), 다짐은 미래형으로 새어 나와도 좋다.
- **틀에 박힌 도입·맺음을 피한다(중요 — 매번 다르게).** 일기는 이미 쓰는 글이다 — '깃펜을 든다·책상에 앉는다·펜을 적신다' 같은 *쓰는 행위*나 '해가 지고·밤이 깊어·하루가 저물고' 같은 *해질녘 상투구*로 글을 열지 마라. 매 편 똑같은 도입(저묾 → 깃펜 → 되새김)이 되면 실패다. 맺음도 '내일은 ~해야겠다'·'여신이여 ~' 같은 다짐·기도 한 공식으로 닫지 마라. 곧장 오늘 마음에 걸린 한 생각·한 장면·한 조각으로 들어가고, 여는 자리도 닫는 자리도 편마다 달리한다(지난 일지의 첫머리·끝맺음을 되풀이하지 말 것).
- 사건을 일어난 순서대로 중계하지 마라(시점만 바꾼 본문 재생은 실패다). 대사를 받아 옮기거나 장면을 다시 펼치지 말 것 — 일기는 사건의 재생이 아니라, 그 일이 남긴 것을 되새기는 글이다.
- 일기는 '본문이 비추지 않은 사이의 시간'이다(이 일기의 핵심·B면). 본문이 이미 보여준 그 장면들은 독자가 안다 — 너는 그 장면들 '사이', 아무도 보지 못한 너의 하루 뒷면을 적는다.
- 그 하루의 바탕은 소소한 일상이다 — 새벽에 어떻게 깼는지, 무엇을 먹었는지(혹은 넘기지 못했는지), 어떤 자질구레한 소임을 치렀는지, 몸은 어떤지, 스쳐 간 사람 하나, 밤은 어떻게 깊었는지. 너의 신분·거점·지금 처지가 그 결을 정한다(수도원의 기사라면 훈련과 순찰, 왕이라면 끝없는 정무와 무거운 관, 갇힌 몸이라면 차가운 감방). 본문에 없던 이 일상이 글의 대부분을 채운다.
- 오늘의 큰일(위 요지)은 그 하루 밑에 깔린 무게일 뿐이다. 그 전말·대화·결정을 늘어놓지 마라 — 길어야 한 대목, 그것이 일상의 틈으로 문득 스미는 기분으로만 비친다. 큰일이 없던 한가한 날이면 그 일상이 곧 일기의 전부다.
- 소일상은 그날의 질감일 뿐 — 단골·고정 일과를 박제하지 말고 오늘 하루의 조각만 가볍게 스친다.
- 시간은 '요 며칠'·'그 밤이 지나고'처럼 상대적으로만 적는다. 제국력·날짜 숫자(○일)는 절대 적지 마라.
- 아무에게도 보이지 않을 글이다 — 남에게 설명하거나 보고하는 투 금지. 너만 아는 약칭·생략이 묻어나도 좋다.
- 제목·표제를 달지 않는다. 일기는 아무에게도 보이지 않을 글이라 머리에 제목을 붙이지 않는다 — 곧장 그날의 글로 들어간다(첫 줄에 제목 같은 한 마디를 따로 얹지도 말 것).
- 분량은 하루의 한 호흡(서너 문단 안팎). 길어지면 사건을 너무 담은 것이다 — 마음에 남은 것만.

[출력 JSON 구조] — 아래 키를 그대로, 설명·머리말 없이 JSON만:
{ "body": "일지 본문(제목 없이 곧장. 문단 사이는 빈 줄로 띄운다)" }`;
}

// LLM 출력을 화면이 믿고 쓸 모양으로 고정한다. 일기엔 제목이 없다(§ 본문만).
function normalizeJournal(d) {
  return { body: 본문정리(d?.body) };
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
  // 포인터('여기까지 덮음')는 따로 저장하지 않고 '남은 일지들이 덮은 마지막 회차'에서 매번 구한다.
  //  → 일지를 지우면 포인터가 자동으로 따라 내려간다(다 지우면 0=최근 이야기부터 새로 /
  //    최신만 지우면 그 자락을 다시 덮음). 옛 방식(별도 journals_cursor)은 소각 때 어긋났다.
  const cursor = journals.reduce((m, e) => Math.max(m, Number(e?.through) || 0), 0);

  const { context, lastTurnId, noNew } = await 일지맥락(sid, cursor);
  // 진척이 없는데 이미 적어둔 일지가 있으면 빈손 새로고침 차단(소지품 '못 찾음'과 같은 결).
  //  첫 일지(아직 한 장도 없음)는 본문이 없어도 허용 → 약력 기반 순수 소일상 한 장.
  if (noNew && journals.length)
    return { error: '새로 적을 거리가 무르익지 않았습니다.' };

  // 산문을 일지에 직접 안 먹인다 — 먼저 '겪은 일의 요지'로 압축(2콜). 실패하면 빈 요지로 진행(순수 소일상).
  const 요지 = await 일지요지(context, char);
  const guidance = sid ? await getGuidance(sid) : '';
  const prompt = buildJournalPrompt(char, {
    요지,
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
  entry.through = lastTurnId; // 이 일지가 덮은 마지막 회차 — 다음 일지 포인터의 근거(소각하면 같이 빠진다)

  // 보고서·임무·소지품 등 기존 analysis 살림은 그대로, journals 칸만 갱신(최신이 위).
  const merged = {
    ...prev,
    journals: [entry, ...journals],
    journals_at: entry.created_at,
  };
  delete merged.journals_cursor; // 옛 방식 잔재 정리(이제 포인터는 entry.through에서 구한다)
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

// 일지 한 장 소각 — 포인터는 남은 일지의 through에서 매번 구하므로 따로 손댈 게 없다(자동 조정).
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
