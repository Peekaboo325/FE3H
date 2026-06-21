// ─────────────────────────────────────────────────────────────────────────
//  서신 교환소 — Gemini Flash가 인물 간 편지를 짓는다. 설계 전체 = docs/서신_설계.md.
//
//  legacy(v1.0) 서신의 실패에서 배운 핵심 원칙:
//   · 판별과 생성을 분리한다. 발신자가 줄거리를 아는지(현장/공개 소문/모름)는
//     별도의 좁은 분류 호출로 먼저 정하고, 줄거리 공급 on/off는 코드가 쥔다.
//     모델의 자제심에 기대지 않는다 — 안 먹인 것만 안 샌다.
//   · 확률 땜빵 대신 디제틱 규칙 — 거리(거점)가 빈도를 만든다(중세의 느린 통신).
//   · 발신자 후보는 단순하게: 활성 등록 인물 + 이 인물의 인연(子) + 모브.
//     legacy의 이름 정규식 스캔·가상 후보 승격은 폐기.
//
//  저장 = letters 표(이야기별·영구 누적·답장 깊이 1). 스키마는 설계서 §1.
//  ⚠️ SYSTEM(박제 세계관)은 넣지 않는다(CLAUDE.md §3). 단 임무와 같은 승인 예외로
//     NAMES(한글 표기 명단) + 호칭 체계 + 금지 몇 줄만 주입한다(서신 한정 — 설계서 §9).
// ─────────────────────────────────────────────────────────────────────────

import {
  getCharacter,
  listCharacters,
  listLetters,
  saveLetters,
  getGuidance,
} from './db.mjs';
import { callGeminiJSON, 약력문, 맥락모으기 } from './report.mjs';
import { buildGuidanceBlock } from './guidance.mjs';
import { NAMES, NAME_DICT } from './worldview.mjs';

// 서신 7종 — legacy 검증 유형 그대로.
const LETTER_TYPES = ['letter', 'note', 'official', 'invitation', 'petition', 'warning', 'will'];

// 거리 → 발신 가중치(설계서 §4). 디제틱 명분: 중세라 먼 곳일수록 편지가 귀하다.
const 거리가중치 = { 거점: 8, 나라: 5, 이웃: 2, 원방: 1, 단절: 0.5 };
// 모브 = '고정 비율'로 먼저 주사위 — 가중치 틈에 끼우면 명부가 커질수록 모브가 묽어진다(실기 발견).
const 모브비율 = 0.4; // 신규 발신의 4할은 이름 없는 손에게서
// 답장 시도율 — 안 답한 편지가 있어도 이 확률로만 답장을 시도(나머지는 신규 발신).
//  안 두면 답장 대기가 쌓일수록 새로고침이 전부 답장으로 빠져 신규·모브가 굶는다(실기 발견 —
//  legacy의 '40% 스킵' 주사위가 바로 이 굶주림 방지였다. 명분이 또렷하므로 부분 복권).
const 답장시도율 = 0.5;
const 고인가중치 = 0.7; // 사망·실종 인연 = 母가 쓰는 '부치지 못할 편지'(보관함행) 전용
const 역할반전 = 0.4; // 함 주인이 발신자가 되는 비율("보낸 편지도 궁금하다" — 빌더)
const 쌍이전서신 = 5; // 같은 쌍의 이전 편지 주입 상한(말투 계승·화제 연속)

// 호칭 체계 + 금지 — 승인 예외(설계서 §9). 지식이 아니라 '예법과 맞춤법'만.
const 호칭과금지 = `[호칭 예법 — 편지에서 틀리면 큰 결례다]
- 대원칙: 호칭은 신분보다 관계가 우선한다. 부모↔자식, 형제, 연인, 오랜 벗처럼 내밀한 사이의 사적 편지에서는 공식 경칭이 아니라 관계의 호칭으로 부른다(아버지는 왕이 된 아들에게도 '아들아'라 쓰지, '폐하'라 쓰지 않는다). 공식 경칭은 공적 관계·격식 문서(official)에서 쓴다.
- 폐하: 아드라스테아 제국 황제, 퍼거스 신성 왕국 국왕에게만.
- 전하: 왕세자·왕자·왕녀·섭정·차기 황위 계승자에게.
- 예하: 세이로스 교단 대사교에게.
- 각하: 레스터 제후 동맹 맹주, 제국 재상 등 유력 귀족에게.
- 경칭은 '편지를 쓰는 시점'에 수신자가 실제로 가진 신분 기준이다 — 아직 오르지 않은 자리의 경칭을 미리 쓰지 않는다.
- 같은 사람을 두 호칭으로 겹쳐 부르지 않는다 — 친칭이면 친칭, 경칭이면 경칭 하나만('네 아버지'라 불렀으면 거기서 끝, 뒤에 이름·경칭을 덧붙이지 않는다).
- 발신자는 자기 자신을 경칭으로 부르지 않는다 — 자신이 왕이라도 자기 명령은 '나의 명'이지 '폐하의 명'이 아니다. 자신의 지위·행위·결정은 편지 끝까지 1인칭으로 쓴다.
- 한 통 안에서 경칭은 처음부터 끝까지 하나로 — 같은 수신자를 전하/폐하로 오락가락 바꿔 부르지 않는다.
- 발신자와 수신자의 신분 차이에 맞는 경어 수위를 지킨다.

[표기 금지]
- '하느님·주님·하나님' 금지 — 포드라의 신앙은 '여신님'이다.
- '몬스터·길드·레벨·스킬' 등 게임·현대 용어 금지. 변이 괴물은 '마수'.
- 문방구는 깃펜·잉크병·양피지·봉랍이다. '벼루·먹·붓·화선지' 같은 동양 문방구 금지 — '붓을 들었다'·'먹을 갈았다' 같은 관용구도 '펜을 들었다'·'잉크를 찍었다'로(중세 유럽 결, 붓은 없다).
- 어떤 시스템 태그([…])도 출력 문자열에 남기지 말 것.`;

// 오표기 강제 치환(후처리 이중벽 — legacy applyStrictTerminology 계승).
const 표기교정 = [
  [/퍼디아/g, '페르디아'],
  [/포들란|폴드라/g, '포드라'],
  [/대주교/g, '대사교'],
  [/가르그 마크 기사단/g, '세이로스 기사단'],
  [/람베르트/g, '람베르'], // 정발 표기 — 실기에서 새는 게 확인된 것은 여기에 보탠다(분실물 대장과 같은 결)
];

// 유서를 남기지 않은 자 — 빌더 규약. 죽음을 예감·대비할 사람이 아니었던 인물은 유서가 발견되지 않는다.
//  · 안젤마(패트리샤): 남편·의붓아들을 배신하면서 유서를 썼을 리 없고, 본인은 살아서 딸을
//    만날 계획이었기에 죽음을 상상조차 안 했다(원작 정합 — 2026-06-13 빌더 확정).
//  같은 결의 인물이 생기면 여기에 보탠다.
const 유서없는자 = new Set(['안젤마 폰 아룬델', '패트리샤']);

// 모브 직함 별칭 접기 — '외래어를 우리 표기로'만 접는다(분실물 대장과 같은 패턴).
//  ⚠️ 서로 다른 직분(시녀≠하녀, 집사≠시종)을 하나로 뭉개지 말 것 — 그건 별칭이 아니라 직함 파괴다.
const 모브별칭 = new Map([
  ['셰프', '요리사'],
  ['주방장', '요리사'], // 빌더 지목 사례(요리사↔셰프↔주방장 흔들림) — 요리사로 통일
  ['메이드', '시녀'], // 외래어 — 왕궁 맥락 기준 시녀로(하녀가 맞다면 이 줄만 바꾸면 됨)
  ['가드', '경비병'],
  ['솔저', '병사'],
]);

const 정리 = (s) => String(s ?? '').replace(/\s{2,}/g, ' ').trim();

// 본문 전용 — 개행(문단)을 보존한다. ⚠️ 위 정리()를 본문에 쓰면 빈 줄(\n\n)이 뭉개져
//  문단이 전부 붙어버린다(실기에서 발견된 버그). 공백·탭만 다듬고 과한 빈 줄만 접는다.
const 본문정리 = (s) =>
  String(s ?? '')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

// 수신인 호칭에서 경어 꼬리(올림·드림…) 제거(legacy sanitizeName 계승).
const 호칭정리 = (name) =>
  정리(name).replace(/\s*(올림|드림|배상|에게|께|귀하|앞)$/, '').trim();

const 제목정리 = (t) => 정리(t).replace(/[()[\]{}]/g, '').trim();

function 용어교정(text) {
  let out = String(text ?? '');
  for (const [bad, good] of 표기교정) out = out.replace(bad, good);
  return out;
}

function 모브직함정리(name) {
  const t = 정리(name);
  return 모브별칭.get(t) || t;
}

// ── 후보 모으기 ───────────────────────────────────────────────────────────
//  함 주인(owner)의 편지 상대 후보를 늘어놓는다. 설계서 §2의 자격 규칙 그대로.
//  kind: 'registered'(등록·활성) / 'bond'(子 또는 잠든 등록자=子 예외) / 'deceased'(사망·실종 — 수신 전용)
function 후보모으기(owner, allChars) {
  const out = [];
  const 이름들 = new Set();
  const bonds = Array.isArray(owner.bonds) ? owner.bonds.filter((b) => b?.name) : [];

  for (const b of bonds) {
    const name = b.name.trim();
    if (!name || 이름들.has(name)) continue;
    이름들.add(name);
    const linked = allChars.find((c) => c.id !== owner.id && (c.name || '').trim() === name);
    const dead =
      b.status === 'deceased' || b.status === 'unknown' ||
      linked?.life_status === 'deceased' || linked?.life_status === 'unknown';
    if (dead) {
      out.push({ kind: 'deceased', name, bond: b, char: linked || null });
      continue;
    }
    // 살아있는 인연: 명부에도 있으면(활성이든 잠들었든) 본 약력을 재료로(子 예외 — 설계서 §2),
    // 명부에 없으면 순수 子(description이 재료).
    out.push({ kind: linked ? 'bond-rich' : 'bond', name, bond: b, char: linked || null });
  }

  // 인연 밖의 활성 등록 인물(생존)도 후보 — 거리 가중치가 빈도를 알아서 낮춘다.
  for (const c of allChars) {
    if (c.id === owner.id) continue;
    if (c.is_active === false) continue; // 잠든 인물은 子 예외로만(위에서 이미 처리)
    if (c.life_status === 'deceased' || c.life_status === 'unknown') continue;
    const name = (c.name || '').trim();
    if (!name || 이름들.has(name)) continue;
    이름들.add(name);
    out.push({ kind: 'registered', name, bond: null, char: c });
  }

  return out;
}

// 후보 한 명의 '발신자/수신자 재료' 텍스트 — 등록 인물은 약력 전체, 子는 인연 설명.
function 후보재료(cand, owner) {
  if (cand.char) return 약력문(cand.char);
  const b = cand.bond || {};
  const L = [`이름: ${cand.name}`];
  if (b.category) L.push(`${owner.name}과(와)의 관계: ${b.category}`);
  if (b.description) L.push(`기록: ${b.description}`);
  return L.join('\n');
}

// ── 판별 호출 (Flash #1) — 거리·등장·사건 공개성 분류 ─────────────────────────
//  생성과 분리된 좁은 분류. 실패하면 안전 폴백(전원 '나라' 거리·미등장·사건 없음)
//  → 편지는 관계만으로 써진다(누설 0 쪽으로 망가짐 — 의도된 안전 방향).
function buildJudgePrompt(owner, candidates, context) {
  const 후보줄 = candidates
    .map((c, i) => {
      const src = c.char
        ? [c.char.base && `거점 ${c.char.base}`, c.char.faction && `소속 ${c.char.faction}`]
            .filter(Boolean)
            .join(', ')
        : '';
      const desc = c.bond?.description || '';
      return `${i + 1}. ${c.name}${src ? ` (${src})` : ''}${desc ? ` — ${desc.slice(0, 120)}` : ''}`;
    })
    .join('\n');
  return `너는 분류 사무관이다. 창작하지 말고 아래 자료만 근거로 판정해 JSON으로만 답하라.

[기준 인물] ${owner.name} — 거점: ${owner.base || '(미상)'} / 소속: ${owner.faction || '(미상)'}

[후보들]
${후보줄}

[최근 이야기 기록]
${context || '(기록 없음)'}

[판정 1 — distance] 각 후보가 기준 인물과 지리적으로 얼마나 떨어져 있는가:
- "거점" = 같은 도시·성·생활권 / "나라" = 같은 국가 안 / "이웃" = 이웃 국가(같은 대륙) / "원방" = 대륙 밖·바다 건너 / "단절" = 거점이 유랑·행방불명이라 닿기 어려움.
- 자료에 위치 단서가 없으면 "거점"으로(가까운 것으로 본다).

[판정 2 — appeared] 기준 인물과 각 후보가 위 [최근 이야기 기록]의 장면에 직접 등장하거나 관여했는가(true/false).
- 이름이 다른 호칭(직함·별명)으로 불려도 같은 인물이면 등장으로 본다. 단순히 이름만 언급된 것은 등장이 아니다.

[판정 3 — confined] 기준 인물과 각 후보가 최근 기록상 구금·포로·뇌옥·중상·의식불명 등으로 '자유로이 편지를 써 보낼 수 없는' 처지인가(true/false).
- 기록에 그런 정황이 없으면 false.

[판정 4 — events] [최근 이야기 기록]에서 굵직한 사건을 0~6개 뽑아 각각 한 문장(gist)으로 적고, 그 사건이 일어난 자리 밖으로 소문이 퍼질 성질인지(public) 판정하라:
- public=true: '많은 사람이 보거나 공표되어' 자연히 저잣거리에 퍼지는 일만 — 전투, 공공연한 죽음, 즉위·임명 같은 드러난 신분 변동, 이미 거리에 도는 추문.
- public=false: ① 일상·사적인 사소한 상호작용(그 자리 사람만 안다). ② **은폐·기밀·내부 지시처럼 '드러나지 않게 처리된 일'은 정치·범죄가 걸려도 false다** — 심문·밀명·증거 인멸·정황 은닉·병세 함구 같은 건 아는 사람만 안다. 정치적으로 굵직하다고 무조건 public이 아니다(궁 밖 백성은 그 내막을 알 길이 없다). 망설여지면 false로.
- gist는 기록의 문장을 그대로 베끼지 말 것 — 멀리 도는 소문이 그러하듯 사람들의 입말로 바꿔 적고, 내부 지시·관청 용어·세부 수치 같은 디테일은 뭉갠다(소문은 닳아서 도착한다).

[출력 JSON]
{ "owner": { "appeared": true, "confined": false }, "candidates": [ { "name": "이름", "distance": "거점", "appeared": false, "confined": false } ], "events": [ { "gist": "한 문장", "public": true } ] }`;
}

async function 판별하기(owner, candidates, context) {
  const 폴백 = {
    cands: new Map(candidates.map((c) => [c.name, { distance: '나라', appeared: false, confined: false }])),
    owner: { appeared: true, confined: false },
    publicEvents: [],
  };
  if (!context || !candidates.length) return 폴백;
  const { data, error } = await callGeminiJSON(buildJudgePrompt(owner, candidates, context), {
    temperature: 0.2,
    maxOutputTokens: 3000,
    thinkingBudget: 512,
    tag: '서신 판별',
  });
  if (error || !data) return 폴백;
  const cands = new Map();
  for (const c of Array.isArray(data.candidates) ? data.candidates : []) {
    const name = 정리(c?.name);
    if (!name) continue;
    cands.set(name, {
      distance: 거리가중치[c?.distance] ? c.distance : '나라',
      appeared: c?.appeared === true,
      confined: c?.confined === true,
    });
  }
  for (const c of candidates)
    if (!cands.has(c.name)) cands.set(c.name, { distance: '나라', appeared: false, confined: false });
  const publicEvents = (Array.isArray(data.events) ? data.events : [])
    .filter((e) => e?.public === true && 정리(e?.gist))
    .map((e) => 정리(e.gist))
    .slice(0, 6);
  return {
    cands,
    owner: { appeared: data?.owner?.appeared !== false, confined: data?.owner?.confined === true },
    publicEvents,
  };
}

// 발신자가 아는 만큼만 — 지식 블록 조립(설계서 §3 수위 3단). 코드가 on/off를 쥔다.
function 지식블록(appeared, publicEvents, context) {
  if (appeared && context) {
    return `[발신자가 아는 최근 소식 — 직접 겪거나 곁에서 본 일]\n${context}`;
  }
  if (publicEvents.length) {
    return `[발신자가 아는 최근 소식 — 멀리서 소문으로만, 닳고 뭉개진 채 들은 것]\n${publicEvents.map((g) => `- ${g}`).join('\n')}\n(주의: 발신자는 궁 안 사정을 모른다. 위는 막연한 풍문일 뿐 — 구체적 내부 행위·명령·기밀을 아는 척하지 말고 '어수선하다더라'·'무슨 일이 있다던데' 수준의 흐릿한 동요로만 스치듯 다룬다. 편지의 본령은 발신자 자신의 용건·관계에 두고, 풍문은 곁들이는 정도로만.)`;
  }
  return `[발신자가 아는 최근 소식]\n(없음 — 발신자는 수신자의 최근 행적을 전혀 모른다. 최근 사건을 아는 척하지 말 것. 둘의 관계·공유한 기억·발신자 자신의 근황으로만 쓴다.)`;
}

// 집안에서 일하는 모브 전용 지식 — '겉으로 드러난 표면'만 준다. 본문 파생(legacy '잉크병 치웠습니다' 맛)·계절 반영을
//  살리되, 누설은 '겉면만 본다/엿듣지 않는다'로 막는다(household 한정 완화 — 빌더 승인).
function 지식블록_가솔(context) {
  if (!context)
    return `[발신자가 곁에서 본 일상]\n(아직 이렇다 할 일이 없다 — 평소 제 직분·일터 근황으로 쓴다.)`;
  return `[발신자가 곁에서 본 일상 — 이 거처에서 일하며 겪은 일]\n${context}\n(주의: 너는 이 집안에서 일하는 사람이다. 위 기록에서 '네 직분으로 자연히 보고 겪을 겉면'에만 반응한다 — 그 표면의 일 하나를 골라 네 일과 엮어 편지를 쓴다. 닫힌 문 안의 사사로운 말·속내·기밀·정치적 내막, 멀리 떨어진 곳의 일은 모른다(엿듣지 않으며 아는 척하지 않는다). 지금 계절·시기는 위 기록을 그대로 따른다.)`;
}

// ── 생성 호출 (Flash #2) — 편지 본문 ─────────────────────────────────────────
function buildLetterPrompt({
  sender, // {name, 재료, isMob, isOwner}
  receiver, // {name, 재료, isMob}
  관계,
  이전서신,
  지식,
  최근유형,
  모브명단,
  replyTo, // 답장이면 원문 {title, content, signature, senderName} (+canDraft)
  forceWill, // 유서 강제
  forceDraft, // 사망·실종 수신자 — 부치지 못할 편지
  confinedSender = false, // 발신자가 구금·유폐 — 쓰되 부칠 길이 없다(지정발신, draft 강제)
  allowSelfDraft = false, // 자발적 draft 허용 — 발신자가 '함 주인'일 때만(남의 보관함은 볼 수 없으니)
  directed = false, // 유저 지정발신 — 침묵 없이 반드시 한 통(설계서 §13)
  기록지침 = '', // 기록자의 말투 교정 등(buildGuidanceBlock 결과). 본문과 같은 결을 편지에도.
}) {
  const 유형안내 = `[유형 — 상황에 맞게 스스로 고른다]
letter=감정·관계 중심의 기본 서신 / note=짧은 쪽지·메모 / official=명령장·보고 등 격식 문서 / invitation=초대장 / petition=요청·탄원 / warning=경고·압박 / will=유서(지시될 때만).`;

  const 부분 = [];
  부분.push(`너는 포드라 세계의 인물이 되어 편지 한 통을 대필하는 서기다. 아래 발신자의 처지·성격·말투에 완전히 빙의해, 발신자가 수신자에게 보내는 편지를 짓는다.
출력은 모두 자연스러운 한국어(올바른 띄어쓰기·문법). 편지 본문의 문체는 발신자의 신분·성격·관계에 맞게(시스템 말투가 아니라 그 사람의 말투로).`);

  부분.push(`[발신자]\n${sender.재료}`);
  부분.push(`[수신자]\n${receiver.재료}`);
  if (관계) 부분.push(`[두 사람의 관계]\n${관계}`);
  if (이전서신) {
    부분.push(`[두 사람이 주고받은 이전 서신]\n${이전서신}`);
    if (!replyTo)
      부분.push(`[이전 서신의 쓰임 — 중요]
- 위 왕래는 말투·호칭·둘 사이의 거리감을 잇는 참고일 뿐이다. 결은 잇되, 대화를 잇지 말 것.
- 이 편지는 답장이 아니다 — 직전 편지에 응답하는 투로 열지 말 것(답신에 대한 감사 인사, 상대 문장에 대한 대답 금지).
- 이미 오간 소식·화제를 되풀이하지 말 것 — 같은 사건을 또 언급하면 실패다. 이번 편지는 새로운 용건을 들고 온다: 발신자 자신의 근황, 다른 사건, 부탁이나 제안, 함께한 기억, 계절 안부 등.`);
  }
  부분.push(지식);

  if (replyTo) {
    부분.push(`[이 편지는 답장이다 — 아래 원문에 응답한다]
보낸 이: ${replyTo.senderName}
제목: ${replyTo.title}
${replyTo.content}

[답장 판단]
- 발신자의 성격·상황·둘의 관계로 보아 답하는 게 자연스러운가를 먼저 판단하라.
- 답하지 않는 게 그 사람답다면 action을 "silence"로 (편지를 만들지 않는다).${replyTo.canDraft ? `\n- 답장을 썼지만 차마 부칠 수 없는 사람이라면 action을 "draft"로 — 그 편지는 발신자의 문갑에 남는다.` : ''}
- 답한다면 원문의 내용·말투를 충실히 받아서 쓴다.`);
  }

  if (forceWill) {
    부분.push(`[유서 — 반드시 type "will"]
이 편지는 발신자가 '생전에 미리 써두었던' 마지막 편지로, 사후에 유품에서 발견되어 수신자에게 전해진 것이다.
- 시간 방화벽(절대 규칙): 쓴 시점은 발신자가 살아 있던 어느 날이다. 발신자는 자신이 언제·어떻게 죽을지 모른다. 자신의 죽음, 죽음의 경위, 그 죽음에 후대가 붙인 사건명·지명을 절대 쓸 수 없다 — 한 번이라도 쓰면 실패다. "너를 지켜내지 못했다"처럼 죽음을 이미 아는 회고도 금지다.
- 주의: 위 [발신자]·[수신자]·[두 사람의 관계] 기록은 전부 발신자가 죽은 '뒤'의 시점에서 적힌 자료다. 거기 섞인 죽음의 경위·사건명은 물론, **수신자가 발신자 사후에 얻은 신분·칭호·이명(즉위·승급 등)도 발신자는 모른다** — 쓰던 시절에 수신자가 가졌던 모습·신분으로 불러라. 그 기록에서는 관계의 본질(누구를 어떻게 아꼈는지)만 길어 올려라.
- 온도(절대 규칙): 유서라고 해서 저절로 다정해지지 않는다. 내용과 온도는 발신자의 성격·행적·두 사람의 관계 기록이 정한다 — 차가운 자는 차갑게, 비밀 많은 자는 끝까지 비밀을 쥔 채, 떳떳하지 못한 자(배신·기만·유기의 기록이 있는 자)의 유서에는 회피·자기변명·이중적인 말이 묻어난다. 죽음을 핑계로 관계를 미화하거나, 기록에 없는 애정·모성·부성을 지어내는 것 금지.
- 결: '만일'을 대비해 남기는 글 — 무엇을 남기는 사람인지는 위 기록이 정한다(진심일 수도, 변명일 수도, 끝내 말하지 못한 것의 암시일 수도 있다).`);
  }

  if (forceDraft) {
    부분.push(`[부치지 못할 편지 — 반드시 status "draft"]
수신자는 이미 세상에 없거나 행방을 모른다. 발신자도 그 사실을 안다.
닿지 않을 것을 알면서도 쓰는 편지다 — 그리움·후회·못 다한 말. action은 "draft"로.`);
  }

  if (confinedSender) {
    부분.push(`[갇힌 자의 편지 — 반드시 status "draft"]
발신자는 지금 구금·유폐된 처지라 이 편지를 밖으로 부칠 길이 없다. 그럼에도 쓴다 — 닿지 못할 줄 알면서도 마음을 옮긴다. action은 "draft"로.`);
  }

  if (directed) {
    부분.push(`[청을 받은 편지 — 침묵 없음]
이 편지는 독자가 발신자에게 '이 사람에게 한 통 쓰라'고 직접 청한 것이다. 반드시 한 통을 쓴다 — action을 "silence"로 비우지 말 것. 부칠지(send) 문갑에 남길지(draft)는 위 규칙대로 발신자의 처지·성격이 정한다.`);
  }

  부분.push(유형안내);
  if (최근유형?.length) 부분.push(`[최근에 오간 유형들] ${최근유형.join(', ')} — 가급적 다른 유형을 고른다.`);

  부분.push(`[편지 규칙]
- title: 편지를 갈무리하는 짧은 한 구절 — 명사형 종결이나 부드러운 의문문. 문장 하나를 통째로 제목 삼지 말 것(특히 편지의 첫 문장을 그대로 가져오는 것 금지). 괄호 금지.
- content: 편지 본문. 유형에 맞는 길이(note는 2~4문장, 나머지는 200~600자 안팎). 머리말(받는 이 호칭)로 자연스럽게 열고, 서명 직전에서 맺는다. 본문 안에 서명을 다시 적지 않는다.
- 문단(중요): 한 덩어리 줄글 금지. 생각의 호흡이 바뀔 때마다 — 대략 2~4문장마다 — 빈 줄로 문단을 나눈다. 머리말 호칭도 한 줄로 떼어 문단을 연다. JSON 문자열 안에서 빈 줄은 \\n\\n으로 적는다. (note처럼 짧은 글만 예외.)
- 발신자는 자신이 물리적으로 알 수 없는 일을 아는 척하지 않는다(위 [발신자가 아는 최근 소식] 범위 안에서만).
- 시기감은 [발신자가 아는 최근 소식]에 드러난 '지금 계절'을 그대로 따른다 — 본문이 봄이면 봄, 여름이면 여름으로(겨울로 고정하지 말 것). 특정 달 이름·날짜만 못박지 않을 뿐(발신자가 정확한 달까지는 모름), 계절감 자체는 현재에 맞춰 또렷이 살린다.
${allowSelfDraft
    ? `- status: 보낼 수 있는 편지면 "send". 성격·체면·상황 때문에 차마 부치지 못할 내용이라면 "draft"(이 경우 더 솔직하고 내밀한 속마음이 담긴다). 남발하지 말 것 — 정말 그 사람이 못 부칠 편지일 때만.`
    : `- status: 항상 "send" — 이 편지는 부쳐진다.`}`);

  const 서명규칙 = sender.isMob
    ? `[직함과 서명 — 발신자는 이름 없는 인물]
- role: 발신자의 직함만 따로 적는다 — 간결한 보통명사(필요하면 짧은 한정어 하나까지: '시장 상인' 결). 경어·수식 문장 금지. 봉투의 발신인 칸에 이 직함이 적힌다.
- signature: 서명은 직함에 수식을 얹어 자유롭게 — 그 사람의 처지·연륜·마음이 묻어나게 한 줄로 짓는다. 신분에 맞으면 '드림·올림' 같은 맺음 경어도 자연스럽다. 영문 표기 없음. 단 사람 이름(개인명)은 넣지 않는다 — 모브는 이름이 없다(직함과 수식만).`
    : `[서명]
- signature: "한글 수식어 + 영문 이름" 꼴. 수식어는 반드시 한글(관계·신분·심경을 담아 자유롭게, 생략도 가능), 이름은 반드시 로마자.
- 영문 이름의 형태는 격식·친밀도에 따라 발신자가 고른다 — 전체 성명 / 이름만 / 애칭 / 이니셜. 격식 있는 사이일수록 길게, 내밀할수록 짧게.
- 이름을 한글로 적으면 실패다 — 서명의 이름은 반드시 로마자(라틴 문자)로 적는다.
- 다른 인물의 이름으로 서명하지 않는다.`;
  부분.push(서명규칙);

  부분.push(`[수신인 호칭]
- recipient_name: 봉투에 적힐 수신인. 수신자가 이름 있는 인물이면 그 이름, 이름 없는 인물이면 본문 맥락에 맞는 한글 직함.
- '올림·드림·배상' 같은 발신자 측 경어를 수신인 이름에 붙이지 말 것.`);

  if (sender.isMob || receiver.isMob) {
    부분.push(`[이름 없는 인물(직함) 규율]
- 직함은 외래어 없이, 한자어 지향의 간결한 보통명사로(필요하면 짧은 한정어 하나까지 — '시장 상인' 결). 구체적인 구역·건물 수식은 금지('동관 침실 시녀' 같은 결은 실패).
- ⚠️ 사람 이름(개인명)을 지어 붙이지 말 것 — 모브는 오직 직함으로만 존재한다(서명·발신인에 개인명을 더하면 실패).
${모브명단?.length ? `- 이 이야기에 이미 등장한 직함: ${모브명단.join(', ')} — 같은 역할이면 같은 표기를 그대로 쓴다. 새로운 역할만 새 직함을 만든다.` : ''}`);
  }

  부분.push(호칭과금지);
  부분.push(`[고유명사 표기 — 쓸 때는 반드시 이 표기로]\n${NAMES.join(', ')}`);

  // 기록자의 말투 교정 등(메인 본문과 같은 결). 위 편지 구조 규칙(호칭·서명·JSON)은 그대로 지키되,
  //  문체·어투는 이 지침을 우선해 따른다. JSON 형식 지시보다 앞에 두어 형식은 안 깨지게.
  if (기록지침) 부분.push(기록지침);

  부분.push(`[출력 JSON 구조] — 아래 키를 그대로, 설명·머리말 없이 JSON만:
{ "action": "send | draft | silence", "type": "letter", "title": "제목", "content": "편지 본문", "signature": "서명", "recipient_name": "수신인", "role": "발신자가 이름 없는 인물일 때만 — 직함" }`);

  return 부분.join('\n\n');
}

// 같은 쌍의 이전 편지(보낸 것만 — draft는 세상에 없는 편지)를 시간순 텍스트로.
function 쌍이전서신문(letters, aId, aName, bId, bName) {
  const side = (l, id, name) =>
    (id && (l.sender_id === id || l.receiver_id === id)) ||
    l.sender_name === name ||
    l.recipient_name === name;
  const pair = letters
    .filter((l) => l.status === 'sent')
    .filter((l) => side(l, aId, aName) && side(l, bId, bName))
    .sort((x, y) => x.id - y.id)
    .slice(-쌍이전서신);
  if (!pair.length) return '';
  return pair
    .map((l) => `〈${l.sender_name} → ${l.recipient_name}〉 ${l.title}\n${l.content}\n— ${l.signature}`)
    .join('\n\n');
}

// 이 이야기에 이미 등장한 모브 직함 명단(표기 안정화 레지스트리 — 설계서 §5).
//  모브 = id 없는 쪽 이름 중, 어느 인물의 인연(子)에도 없는 것.
function 모브명단모으기(letters, allChars) {
  const 인연이름 = new Set();
  for (const c of allChars)
    for (const b of Array.isArray(c.bonds) ? c.bonds : []) if (b?.name) 인연이름.add(b.name.trim());
  const out = new Set();
  for (const l of letters) {
    if (!l.sender_id && l.sender_name && !인연이름.has(l.sender_name)) out.add(l.sender_name);
    if (!l.receiver_id && l.recipient_name && !인연이름.has(l.recipient_name)) out.add(l.recipient_name);
  }
  return [...out];
}

// 가중치 추첨.
function 추첨(weighted) {
  const total = weighted.reduce((s, w) => s + w.weight, 0);
  if (total <= 0) return null;
  let r = Math.random() * total;
  for (const w of weighted) {
    r -= w.weight;
    if (r <= 0) return w;
  }
  return weighted[weighted.length - 1];
}

// 생성 결과를 행으로 다듬는다 — ID·이름은 모델 출력을 안 믿고 코드가 박는다(legacy 계승).
//  allowDraft=false인데 모델이 draft를 고집하면 침묵으로 본다 — 남(子·모브·타 인물)의 draft는
//  이 함에서 보여줄 수 없어 고아 행이 되기 때문(실기 버그: 토스트는 떴는데 보관함이 빈 사고).
function 행만들기(d, { storyId, sender, receiver, replyToId = null, forceWill = false, forceDraft = false, allowDraft = false }) {
  const action = 정리(d?.action).toLowerCase();
  if (action === 'silence') return null;
  const isDraft = forceDraft || action === 'draft' || 정리(d?.status).toLowerCase() === 'draft';
  if (isDraft && !forceDraft && !allowDraft) return null; // 부치지도 보이지도 못할 편지 = 침묵
  let type = 정리(d?.type).toLowerCase();
  if (forceWill) type = 'will';
  if (!LETTER_TYPES.includes(type)) type = 'letter';

  // 모브 직함 — 모델이 따로 내놓는 role 칸이 단일 출처(목록·발신인용. 서명과 분리 — 빌더 결정).
  const role = sender.isMob ? 모브직함정리(정리(d?.role)) : '';

  let signature = 용어교정(정리(d?.signature));
  // 빙의 차단 — 서명이 발신자가 아닌 다른 등장 이름을 담으면 발신자 이름으로 교체.
  if (sender.타인이름?.some((n) => n && signature.includes(n))) signature = sender.name;
  // 서명 비었을 때 폴백 — 모브는 직함으로(자리표시자 '(직함)'이 새던 사고 차단), 네임드는 이름으로.
  if (!signature) signature = sender.isMob ? role || '이름 모를 손' : sender.name;
  // 영문 서명 폴백 — 규칙(이름은 로마자)을 어기고 한글로만 서명하면, 아는 영문명으로 치환.
  //  영문명 출처: ① 명부 english_name ② 고유명사 사전(NAME_DICT — 명부 미등록 인연도 커버).
  //  (모브는 한글 서명이 정답이라 제외. 둘 다 없는 비정사 인물만 모델의 로마자 표기에 맡긴다.)
  const senderEnglish = sender.english || NAME_DICT[sender.name] || '';
  if (!sender.isMob && senderEnglish && !/[A-Za-z]/.test(signature)) {
    const 한첫 = sender.name.split(/\s+/)[0];
    const 영첫 = senderEnglish.split(/\s+/)[0];
    if (signature.includes(sender.name)) signature = signature.replace(sender.name, senderEnglish);
    else if (signature.includes(한첫)) signature = signature.replace(한첫, 영첫);
    else signature = `${signature} ${영첫}`.trim();
  }

  let recipient = 호칭정리(용어교정(d?.recipient_name)) || (receiver.isMob ? '이름 모를 손' : receiver.name);
  if (receiver.isMob) recipient = 모브직함정리(recipient);

  let content = 용어교정(본문정리(d?.content));
  if (!content) return null;
  // 본문 끝에 서명을 또 적는 규칙 위반 보정 — 마지막 줄이 서명·직함과 같으면 걷어낸다.
  {
    const lines = content.split('\n');
    let i = lines.length - 1;
    while (i >= 0 && !lines[i].trim()) i--;
    const 끝줄 = (lines[i] || '').trim().replace(/^[—\-–]\s*/, '').replace(/\s*(드림|올림|배상)$/, '').trim();
    const 후보들 = [signature, role, sender.name].filter(Boolean).map((s) => s.trim());
    if (끝줄 && 끝줄.length <= 30 && 후보들.some((s) => 끝줄 === s || s.endsWith(끝줄) || 끝줄.endsWith(s))) {
      content = lines.slice(0, i).join('\n').trim();
    }
    if (!content) return null;
  }

  return {
    story_id: storyId,
    sender_id: sender.id ?? null,
    receiver_id: receiver.id ?? null,
    sender_name: sender.isMob ? role || 모브직함정리(sender.name) || '이름 모를 손' : sender.name,
    recipient_name: recipient,
    type,
    status: isDraft ? 'draft' : 'sent',
    title: 제목정리(용어교정(d?.title)) || '제목 없는 편지',
    content,
    signature,
    reply_to_id: replyToId,
    is_sealed: !isDraft, // 봉인 = 아직 안 읽음(보낸 편지만 — draft는 봉인 없음)
  };
}

// ── 교환소 오케스트레이터 — 새로고침 1회 = 편지 1통 ─────────────────────────
export async function runLetters({ characterId, storyId } = {}) {
  if (!characterId) return { error: '인물 지목이 없습니다.' };
  const owner = await getCharacter(characterId);
  if (!owner) return { error: '인물을 찾을 수 없습니다.' };
  if (owner.life_status === 'deceased' || owner.life_status === 'unknown')
    return { error: '소식이 닿지 않는 인물입니다.' };
  if (owner.is_active === false) return { error: '잠든 인물에게는 서신이 닿지 않습니다.' };

  const sid = storyId || owner.story_id || null;
  const [{ characters: allChars }, { letters: storyLetters, error: dbErr }, context, 지침] =
    await Promise.all([
      sid ? listCharacters(sid) : Promise.resolve({ characters: [] }),
      listLetters(sid),
      맥락모으기(sid),
      getGuidance(sid).catch(() => ''), // 기록 지침(장별·말투 교정 등) — 없으면 ''
    ]);
  if (dbErr) return { error: `서신함이 아직 마련되지 않았습니다 — ${dbErr}` };
  const 기록지침 = buildGuidanceBlock(지침);

  const ownerLetters = storyLetters.filter(
    (l) =>
      l.sender_id === owner.id ||
      l.receiver_id === owner.id ||
      // 子·모브 쪽 통(id 없음)도 이름이 owner와 묶이면 이 함의 것
      (!l.sender_id && l.receiver_id === owner.id) ||
      (!l.receiver_id && l.sender_id === owner.id),
  );
  const 모브명단 = 모브명단모으기(storyLetters, allChars);
  const 최근유형 = ownerLetters.slice(0, 5).map((l) => l.type);
  const candidates = 후보모으기(owner, allChars);

  // ① 유서 — 사망 인연 중 아직 세상에 유서가 없는 이가 있으면 최우선(설계서 §6: 전 세계 1통).
  const 사망인연 = candidates.filter(
    (c) => c.kind === 'deceased' && (c.bond?.status === 'deceased' || c.char?.life_status === 'deceased'),
  );
  for (const dc of 사망인연) {
    if (유서없는자.has(dc.name)) continue; // 유서를 남기지 않은 자(빌더 규약) — 영원한 침묵
    const has = storyLetters.some((l) => l.type === 'will' && l.sender_name === dc.name);
    if (has) continue;
    const sender = { id: dc.char?.id ?? null, name: dc.name, english: dc.char?.english_name || '', 재료: 후보재료(dc, owner), isMob: false, 타인이름: [] };
    const receiver = { id: owner.id, name: owner.name, 재료: 약력문(owner), isMob: false };
    const prompt = buildLetterPrompt({
      sender, receiver,
      관계: dc.bond?.description || '',
      이전서신: 쌍이전서신문(ownerLetters, dc.char?.id ?? null, dc.name, owner.id, owner.name),
      지식: `[발신자가 아는 최근 소식]\n(없음 — 생전에 쓴 편지다.)`,
      최근유형: [], 모브명단, 기록지침,
      forceWill: true,
    });
    const { data, error } = await callGeminiJSON(prompt, { temperature: 0.9, maxOutputTokens: 4000, thinkingBudget: 512, tag: '서신' });
    if (error) return { error };
    const row = 행만들기(data, { storyId: sid, sender, receiver, forceWill: true });
    if (row) {
      row.status = 'sent'; // 유서는 발견되어 '도착'한다
      row.is_sealed = true;
      const saved = await saveLetters([row]);
      if (saved.error) return { error: saved.error };
      return { added: saved.letters, kind: 'will' };
    }
    break; // 침묵이면 일반 흐름으로
  }

  // ② 판별(Flash #1) — 거리·등장·구금·공개 사건. 실패해도 안전 폴백으로 계속.
  const { cands: 판별, owner: 주인판정, publicEvents } = await 판별하기(owner, candidates, context);
  const ownerAppeared = 주인판정.appeared; // 본인이 발신할 때의 지식 수위
  const ownerConfined = 주인판정.confined; // 구금·포로 등 — 발신 불가(수신·draft 대상은 가능)

  // ③ 답장 우선 — 안 답한 받은 편지가 있으면 답장을 시도(모델이 침묵할 수 있음).
  const 답장됨 = new Set(
    ownerLetters.filter((l) => l.reply_to_id && l.status === 'sent').map((l) => l.reply_to_id),
  );
  const draft답장 = new Set(
    ownerLetters.filter((l) => l.reply_to_id && l.status === 'draft').map((l) => l.reply_to_id),
  );
  const pending = ownerLetters
    .filter(
      (l) =>
        l.status === 'sent' && !l.reply_to_id && !답장됨.has(l.id) &&
        l.type !== 'will' && l.type !== 'note',
    )
    .sort((a, b) => a.id - b.id)[0];

  if (pending && Math.random() < 답장시도율) {
    // 응답자 = 원문의 수신자.
    const rIsOwner = pending.receiver_id === owner.id;
    const rName = rIsOwner ? owner.name : pending.recipient_name;
    const rCand = rIsOwner ? null : candidates.find((c) => c.name === rName);
    const rIsMob = !rIsOwner && !rCand; // 후보(인연·등록)에 없는 무명 = 모브
    // 구금된 자는 답장을 못 보낸다(옥중에서 깃펜·전령이 없다 — 침묵으로 보고 신규 발신으로).
    const r구금 = rIsOwner ? ownerConfined : (rCand && 판별.get(rName)?.confined) || false;
    const 응답가능 = !r구금 && (rIsOwner || rIsMob || (rCand && rCand.kind !== 'deceased'));
    if (응답가능) {
      const sender = rIsOwner
        ? { id: owner.id, name: owner.name, english: owner.english_name || '', 재료: 약력문(owner), isMob: false }
        : rIsMob
          ? { id: null, name: rName, 재료: `이름 없는 인물 — 직함: ${rName}`, isMob: true }
          : { id: rCand.char?.id ?? null, name: rName, english: rCand.char?.english_name || '', 재료: 후보재료(rCand, owner), isMob: false };
      const oIsOwner = pending.sender_id === owner.id;
      const oCand = oIsOwner ? null : candidates.find((c) => c.name === pending.sender_name);
      const receiver = oIsOwner
        ? { id: owner.id, name: owner.name, 재료: 약력문(owner), isMob: false }
        : oCand
          ? { id: oCand.char?.id ?? null, name: pending.sender_name, 재료: 후보재료(oCand, owner), isMob: false }
          : { id: null, name: pending.sender_name, 재료: `이름 없는 인물 — 직함: ${pending.sender_name}`, isMob: !pending.sender_id };
      const sJudge = 판별.get(sender.name) || { appeared: rIsOwner ? ownerAppeared : false };
      sender.타인이름 = allChars.map((c) => c.name).filter((n) => n && n !== sender.name);
      // 자발적 draft는 응답자가 '함 주인'일 때만 — 남의 draft는 이 함에서 볼 수 없다.
      const selfDraftOk = rIsOwner && !draft답장.has(pending.id);
      const prompt = buildLetterPrompt({
        sender, receiver,
        관계: (rCand?.bond?.description || oCand?.bond?.description || ''),
        이전서신: 쌍이전서신문(ownerLetters, sender.id, sender.name, receiver.id, receiver.name),
        지식: rIsMob ? 지식블록_가솔(context) : 지식블록(sJudge.appeared, publicEvents, context),
        최근유형, 모브명단, 기록지침,
        replyTo: {
          senderName: pending.sender_name,
          title: pending.title,
          content: pending.content,
          canDraft: selfDraftOk,
        },
        allowSelfDraft: selfDraftOk,
      });
      const { data, error } = await callGeminiJSON(prompt, { temperature: 0.9, maxOutputTokens: 4000, thinkingBudget: 512, tag: '서신' });
      if (!error) {
        const row = 행만들기(data, { storyId: sid, sender, receiver, replyToId: pending.id, allowDraft: selfDraftOk });
        if (row) {
          const saved = await saveLetters([row]);
          if (saved.error) return { error: saved.error };
          return { added: saved.letters, kind: 'reply' };
        }
        // 침묵 → 신규 발신으로 넘어간다(설계서 §6 — 유저가 빈손이 안 되게).
      }
    }
  }

  // ④ 신규 발신 — 모브 먼저 고정 비율 주사위, 아니면 거리 가중 추첨으로 상대를 고른다.
  let cand;
  if (Math.random() < 모브비율 || !candidates.length) {
    cand = { kind: 'mob', name: null };
  } else {
    const weighted = candidates.map((c) => ({
      cand: c,
      weight:
        c.kind === 'deceased'
          ? 고인가중치
          : 거리가중치[판별.get(c.name)?.distance || '나라'] || 거리가중치.나라,
    }));
    const picked = 추첨(weighted);
    cand = picked ? picked.cand : { kind: 'mob', name: null };
  }

  // 사망·실종 인연이 뽑히면 = 母가 쓰는 부치지 못할 편지(보관함행) — 방향 고정.
  const isDead = cand.kind === 'deceased';
  // 구금된 상대는 발신을 못 한다 — 뽑혔으면 주인이 그쪽으로 쓰는 방향으로 고정(옥중 수신은 가능).
  const cand구금 = cand.kind !== 'mob' && cand.name ? 판별.get(cand.name)?.confined === true : false;
  // 역할 반전 — 함 주인이 발신자가 된다(40%). 모브는 주인에게 보내는 쪽이 기본.
  let ownerSends = isDead || cand구금 || (cand.kind !== 'mob' && Math.random() < 역할반전);
  // 주인 본인이 구금이면 주인은 발신 불가 — 받기만 한다(옥중 수신·간수의 쪽지는 가능).
  if (ownerConfined) {
    if (cand구금 || isDead) return { error: '지금은 펜을 들 수 있는 이가 없습니다.' };
    ownerSends = false;
  }

  let other;
  if (cand.kind === 'mob') {
    other = { id: null, name: null, 재료: '', isMob: true };
  } else {
    other = { id: cand.char?.id ?? null, name: cand.name, english: cand.char?.english_name || '', 재료: 후보재료(cand, owner), isMob: false };
  }
  const ownerSide = { id: owner.id, name: owner.name, english: owner.english_name || '', 재료: 약력문(owner), isMob: false };
  const sender = ownerSends ? ownerSide : other;
  const receiver = ownerSends ? other : ownerSide;
  sender.타인이름 = allChars.map((c) => c.name).filter((n) => n && n !== sender.name);

  // 모브 발신자: 이름 대신 직함(role 칸)을 모델이 짓는다 — 자기 직분의 '용건'으로 쓴다(legacy처럼).
  if (sender.isMob) {
    sender.재료 = `이름 없는 인물 — ${owner.name}의 생활권(${owner.base || '거처'} 부근)에서 일하며 수신자와 닿는 평범한 사람이다. 직함(역할)을 하나 정하고, 그 직분으로서 수신자에게 보낼 '자기 용건'으로 쓴다(맡은 일의 보고·청·전달·확인 등, 직분에 걸맞은 것이면 무엇이든). 안부만으로 채우지 말되, 직분도 용건도 폭넓게 골라 — 같은 직종·같은 소재로 쏠리면 실패다. 궁 안 사정·기밀·정세는 제 직분 밖이라 모르니 아는 척하지 않는다.`;
    sender.name = '';
  }
  if (receiver.isMob) {
    receiver.재료 = `이름 없는 인물 — ${owner.name}의 생활권에서 살아가는 평범한 사람. 직함으로만 부른다.`;
    receiver.name = '';
  }

  // 발신자의 지식 수위: 주인이면 주인의 등장 여부, 모브면 소문 수위, 그 외엔 판별 결과.
  const sAppeared = sender.id === owner.id ? ownerAppeared : sender.isMob ? false : (판별.get(sender.name)?.appeared ?? false);

  const prompt = buildLetterPrompt({
    sender, receiver,
    관계: cand.kind === 'mob' ? '' : cand.bond?.description || '',
    이전서신: cand.kind === 'mob' ? '' : 쌍이전서신문(ownerLetters, other.id, cand.name, owner.id, owner.name),
    지식: sender.isMob ? 지식블록_가솔(context) : 지식블록(sAppeared, publicEvents, context),
    최근유형, 모브명단, 기록지침,
    forceDraft: isDead,
    allowSelfDraft: ownerSends, // 함 주인이 쓸 때만 자발적 draft 가능
  });
  const { data, error } = await callGeminiJSON(prompt, { temperature: 0.9, maxOutputTokens: 4000, thinkingBudget: 512, tag: '서신' });
  if (error) return { error };
  const row = 행만들기(data, { storyId: sid, sender, receiver, forceDraft: isDead, allowDraft: ownerSends });
  if (!row) return { error: '이번에는 아무도 펜을 들지 않았습니다 — 다시 시도하십시오.' };

  const saved = await saveLetters([row]);
  if (saved.error) return { error: saved.error };
  return { added: saved.letters, kind: row.status === 'draft' ? 'draft' : 'new' };
}

// ── 수신 지정 (유저 지정발신) — 설계서 §13 ──────────────────────────────────
//  A(함 주인)가 인연 중 지목된 수신자에게 쓴다. 후보 추첨 주사위를 건너뛰는 별도 경로.
//   · 유저가 정하는 건 '누구에게'뿐 — 지식 판별(§3)은 A 기준 그대로(누설 안전).
//   · AI는 항상 한 통을 쓴다(침묵 없음). 단 발송(send)/보관(draft)은 인물 판단.
//   · 상태 게이트: A 사망=불가 / A 구금=draft / 수신자 사망·실종=draft(부치지 못할 편지).
export async function runDirectedLetter({ characterId, storyId, receiverId, receiverName } = {}) {
  if (!characterId || (!receiverId && !receiverName))
    return { error: '발신자와 수신자를 지목하십시오.' };
  const owner = await getCharacter(characterId);
  if (!owner) return { error: '인물을 찾을 수 없습니다.' };
  if (owner.life_status === 'deceased' || owner.life_status === 'unknown')
    return { error: '세상을 떠난 이는 새 편지를 쓰지 못합니다.' }; // A 사망 = 불가(유서만 별도)

  const sid = storyId || owner.story_id || null;
  const [{ characters: allChars }, { letters: storyLetters, error: dbErr }, context, 지침] =
    await Promise.all([
      sid ? listCharacters(sid) : Promise.resolve({ characters: [] }),
      listLetters(sid),
      맥락모으기(sid),
      getGuidance(sid).catch(() => ''), // 기록 지침(장별·말투 교정 등) — 없으면 ''
    ]);
  if (dbErr) return { error: `서신함이 아직 마련되지 않았습니다 — ${dbErr}` };
  const 기록지침 = buildGuidanceBlock(지침);

  const ownerLetters = storyLetters.filter(
    (l) =>
      l.sender_id === owner.id ||
      l.receiver_id === owner.id ||
      (!l.sender_id && l.receiver_id === owner.id) ||
      (!l.receiver_id && l.sender_id === owner.id),
  );
  const 모브명단 = 모브명단모으기(storyLetters, allChars);
  const 최근유형 = ownerLetters.slice(0, 5).map((l) => l.type);

  // 수신자 해석 — 등록 인물(receiverId·약력) 또는 인연 칸만 있는 미등록 상대(receiverName·고인 포함).
  let recv, recvGone, 관계;
  if (receiverId) {
    const rc = await getCharacter(Number(receiverId));
    if (!rc) return { error: '수신자를 찾을 수 없습니다.' };
    if (rc.id === owner.id) return { error: '자신에게는 부칠 수 없습니다.' };
    const bond =
      (Array.isArray(owner.bonds) ? owner.bonds : []).find(
        (b) => b?.name && b.name.trim() === (rc.name || '').trim(),
      ) || null;
    recv = { id: rc.id, name: rc.name, english: rc.english_name || '', 재료: 약력문(rc), isMob: false };
    recvGone = rc.life_status === 'deceased' || rc.life_status === 'unknown';
    관계 = bond?.description || '';
  } else {
    const nm = String(receiverName).trim();
    const bond =
      (Array.isArray(owner.bonds) ? owner.bonds : []).find(
        (b) => b?.name && b.name.trim() === nm,
      ) || null;
    if (!bond) return { error: '그런 인연을 찾을 수 없습니다.' };
    recv = {
      id: null,
      name: nm,
      english: NAME_DICT[nm] || '',
      재료: 후보재료({ name: nm, bond, char: null }, owner),
      isMob: false,
    };
    recvGone = bond.status === 'deceased' || bond.status === 'unknown';
    관계 = bond.description || '';
  }

  // 판별 — A(발신자)의 지식 수위·구금 여부 + 공개 사건. (거리는 지정발신엔 무의미.)
  const recvCand = {
    kind: recvGone ? 'deceased' : 'registered',
    name: recv.name,
    bond: 관계 ? { description: 관계 } : null,
    char: null,
  };
  const { owner: 주인판정, publicEvents } = await 판별하기(owner, [recvCand], context);
  const ownerAppeared = 주인판정.appeared;
  const ownerConfined = 주인판정.confined;

  const sender = {
    id: owner.id,
    name: owner.name,
    english: owner.english_name || '',
    재료: 약력문(owner),
    isMob: false,
    타인이름: allChars.map((c) => c.name).filter((n) => n && n !== owner.name),
  };

  const forceDraftStatus = recvGone || ownerConfined; // 둘 중 하나면 draft 고정

  const prompt = buildLetterPrompt({
    sender,
    receiver: recv,
    관계,
    이전서신: 쌍이전서신문(ownerLetters, sender.id, sender.name, recv.id, recv.name),
    지식: 지식블록(ownerAppeared, publicEvents, context),
    최근유형,
    모브명단,
    기록지침,
    forceDraft: recvGone, // 수신자 사망·실종 → 부치지 못할 편지(텍스트 + 상태)
    confinedSender: ownerConfined && !recvGone, // A 구금 → 갇힌 자의 편지(텍스트)
    allowSelfDraft: !forceDraftStatus, // 강제가 아니면 AI가 send/draft 판단
    directed: true, // 침묵 없이 반드시 한 통
  });
  const { data, error } = await callGeminiJSON(prompt, {
    temperature: 0.9,
    maxOutputTokens: 4000,
    thinkingBudget: 512,
    tag: '서신',
  });
  if (error) return { error };
  const row = 행만들기(data, {
    storyId: sid,
    sender,
    receiver: recv,
    forceDraft: forceDraftStatus, // 상태 강제(둘 중 하나면 draft)
    allowDraft: true, // 지정발신은 침묵으로 사라지지 않는다(send or draft)
  });
  if (!row) return { error: '편지가 끝내 쓰이지 못했습니다 — 다시 청해 보십시오.' };

  const saved = await saveLetters([row]);
  if (saved.error) return { error: saved.error };
  return { added: saved.letters, kind: row.status === 'draft' ? 'draft' : 'new' };
}
