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
} from './db.mjs';
import { callGeminiJSON, 약력문, 맥락모으기 } from './report.mjs';
import { NAMES } from './worldview.mjs';

// 서신 7종 — legacy 검증 유형 그대로.
const LETTER_TYPES = ['letter', 'note', 'official', 'invitation', 'petition', 'warning', 'will'];

// 거리 → 발신 가중치(설계서 §4). 디제틱 명분: 중세라 먼 곳일수록 편지가 귀하다.
const 거리가중치 = { 거점: 8, 나라: 5, 이웃: 2, 원방: 1, 단절: 0.5 };
const 모브가중치 = 6; // 모브 = 수신자와 같은 생활권의 익명 인물
const 고인가중치 = 0.7; // 사망·실종 인연 = 母가 쓰는 '부치지 못할 편지'(보관함행) 전용
const 역할반전 = 0.4; // 함 주인이 발신자가 되는 비율("보낸 편지도 궁금하다" — 빌더)
const 쌍이전서신 = 5; // 같은 쌍의 이전 편지 주입 상한(말투 계승·화제 연속)

// 호칭 체계 + 금지 — 승인 예외(설계서 §9). 지식이 아니라 '예법과 맞춤법'만.
const 호칭과금지 = `[호칭 예법 — 편지에서 틀리면 큰 결례다]
- 폐하: 아드라스테아 제국 황제, 퍼거스 신성 왕국 국왕에게만.
- 전하: 왕세자·왕자·왕녀·섭정·차기 황위 계승자에게.
- 예하: 세이로스 교단 대사교에게.
- 각하: 레스터 제후 동맹 맹주, 제국 재상 등 유력 귀족에게.
- 발신자와 수신자의 신분 차이에 맞는 경어 수위를 지킨다.

[표기 금지]
- '하느님·주님·하나님' 금지 — 포드라의 신앙은 '여신님'이다.
- '몬스터·길드·레벨·스킬' 등 게임·현대 용어 금지. 변이 괴물은 '마수'.
- 어떤 시스템 태그([…])도 출력 문자열에 남기지 말 것.`;

// 오표기 강제 치환(후처리 이중벽 — legacy applyStrictTerminology 계승).
const 표기교정 = [
  [/퍼디아/g, '페르디아'],
  [/포들란|폴드라/g, '포드라'],
  [/대주교/g, '대사교'],
  [/가르그 마크 기사단/g, '세이로스 기사단'],
  [/람베르트/g, '람베르'], // 정발 표기 — 실기에서 새는 게 확인된 것은 여기에 보탠다(분실물 대장과 같은 결)
];

// 모브 직함 별칭 접기 — 외래어·동의어를 우리 표기로(분실물 대장과 같은 패턴).
const 모브별칭 = new Map([
  ['셰프', '요리사'],
  ['주방장', '요리사'],
  ['메이드', '시녀'],
  ['하녀', '시녀'],
  ['집사', '시종'],
  ['가드', '경비병'],
  ['솔저', '병사'],
]);

const 정리 = (s) => String(s ?? '').replace(/\s{2,}/g, ' ').trim();

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

[판정 2 — appeared] 각 후보가 위 [최근 이야기 기록]의 장면에 직접 등장하거나 관여했는가(true/false).
- 이름이 다른 호칭(직함·별명)으로 불려도 같은 인물이면 등장으로 본다. 단순히 이름만 언급된 것은 등장이 아니다.

[판정 3 — events] [최근 이야기 기록]에서 굵직한 사건을 0~6개 뽑아 각각 한 문장(gist)으로 적고, 그 사건이 일어난 자리 밖으로 소문이 퍼질 성질인지(public) 판정하라:
- public=true: 생사·범죄·정치·신분 변동·전투·추문이 걸린 일(소문이 된다).
- public=false: 일상·사적인 사소한 상호작용(그 자리 사람만 안다).

[출력 JSON]
{ "candidates": [ { "name": "이름", "distance": "거점", "appeared": false } ], "events": [ { "gist": "한 문장", "public": true } ] }`;
}

async function 판별하기(owner, candidates, context) {
  const 폴백 = {
    cands: new Map(candidates.map((c) => [c.name, { distance: '나라', appeared: false }])),
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
    });
  }
  for (const c of candidates) if (!cands.has(c.name)) cands.set(c.name, { distance: '나라', appeared: false });
  const publicEvents = (Array.isArray(data.events) ? data.events : [])
    .filter((e) => e?.public === true && 정리(e?.gist))
    .map((e) => 정리(e.gist))
    .slice(0, 6);
  return { cands, publicEvents };
}

// 발신자가 아는 만큼만 — 지식 블록 조립(설계서 §3 수위 3단). 코드가 on/off를 쥔다.
function 지식블록(appeared, publicEvents, context) {
  if (appeared && context) {
    return `[발신자가 아는 최근 소식 — 직접 겪거나 곁에서 본 일]\n${context}`;
  }
  if (publicEvents.length) {
    return `[발신자가 아는 최근 소식 — 멀리서 소문으로만 들은 것]\n${publicEvents.map((g) => `- ${g}`).join('\n')}\n(주의: 발신자는 위 소문의 자세한 내막·현장 분위기를 모른다. 들은 풍문 수준으로만, 걱정·궁금증·축하 같은 반응으로 다룬다.)`;
  }
  return `[발신자가 아는 최근 소식]\n(없음 — 발신자는 수신자의 최근 행적을 전혀 모른다. 최근 사건을 아는 척하지 말 것. 둘의 관계·공유한 기억·발신자 자신의 근황으로만 쓴다.)`;
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
}) {
  const 유형안내 = `[유형 — 상황에 맞게 스스로 고른다]
letter=감정·관계 중심의 기본 서신 / note=짧은 쪽지·메모 / official=명령장·보고 등 격식 문서 / invitation=초대장 / petition=요청·탄원 / warning=경고·압박 / will=유서(지시될 때만).`;

  const 부분 = [];
  부분.push(`너는 포드라 세계의 인물이 되어 편지 한 통을 대필하는 서기다. 아래 발신자의 처지·성격·말투에 완전히 빙의해, 발신자가 수신자에게 보내는 편지를 짓는다.
출력은 모두 자연스러운 한국어(올바른 띄어쓰기·문법). 편지 본문의 문체는 발신자의 신분·성격·관계에 맞게(시스템 말투가 아니라 그 사람의 말투로).`);

  부분.push(`[발신자]\n${sender.재료}`);
  부분.push(`[수신자]\n${receiver.재료}`);
  if (관계) 부분.push(`[두 사람의 관계]\n${관계}`);
  if (이전서신) 부분.push(`[두 사람이 주고받은 이전 서신 — 말투·호칭·화제를 이어간다]\n${이전서신}`);
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
- 주의: 위 [발신자]·[두 사람의 관계] 기록은 발신자가 죽은 '뒤'의 시점에서 적힌 자료다. 거기 죽음의 경위·사건명이 섞여 있어도 발신자 본인은 모르는 일이다. 그 기록에서는 관계의 본질(누구를 어떻게 아꼈는지)만 길어 올려라.
- 결: 위험한 소임을 사는 이가 '만일'을 대비해 남기는 글 — 평소 못 다한 진심, 상대의 앞날에 대한 당부와 축복.`);
  }

  if (forceDraft) {
    부분.push(`[부치지 못할 편지 — 반드시 status "draft"]
수신자는 이미 세상에 없거나 행방을 모른다. 발신자도 그 사실을 안다.
닿지 않을 것을 알면서도 쓰는 편지다 — 그리움·후회·못 다한 말. action은 "draft"로.`);
  }

  부분.push(유형안내);
  if (최근유형?.length) 부분.push(`[최근에 오간 유형들] ${최근유형.join(', ')} — 가급적 다른 유형을 고른다.`);

  부분.push(`[편지 규칙]
- title: 편지를 갈무리하는 짧은 한 구절 — 명사형 종결이나 부드러운 의문문. 문장 하나를 통째로 제목 삼지 말 것(특히 편지의 첫 문장을 그대로 가져오는 것 금지). 괄호 금지.
- content: 편지 본문. 유형에 맞는 길이(note는 2~4문장, 나머지는 200~600자 안팎). 머리말(받는 이 호칭)로 자연스럽게 열고, 서명 직전에서 맺는다. 본문 안에 서명을 다시 적지 않는다.
- 발신자는 자신이 물리적으로 알 수 없는 일을 아는 척하지 않는다(위 [발신자가 아는 최근 소식] 범위 안에서만).
- status: 보낼 수 있는 편지면 "send". 성격·체면·상황 때문에 차마 부치지 못할 내용이라면 "draft"(이 경우 더 솔직하고 내밀한 속마음이 담긴다). 남발하지 말 것 — 정말 그 사람이 못 부칠 편지일 때만.`);

  const 서명규칙 = sender.isMob
    ? `[서명 — 발신자는 이름 없는 인물]
- signature: 한글 직함만 적는다(예 형식이 아니라 발신자의 직함 그대로). 영문 표기 없음.`
    : `[서명]
- signature: "한글 수식어 + 영문 이름" 꼴. 수식어는 반드시 한글(관계·신분·심경을 담아 자유롭게, 생략도 가능), 이름은 반드시 로마자.
- 영문 이름의 형태는 격식·친밀도에 따라 발신자가 고른다 — 전체 성명 / 이름만 / 애칭 / 이니셜. 격식 있는 사이일수록 길게, 내밀할수록 짧게.
- 다른 인물의 이름으로 서명하지 않는다.`;
  부분.push(서명규칙);

  부분.push(`[수신인 호칭]
- recipient_name: 봉투에 적힐 수신인. 수신자가 이름 있는 인물이면 그 이름, 이름 없는 인물이면 본문 맥락에 맞는 한글 직함.
- '올림·드림·배상' 같은 발신자 측 경어를 수신인 이름에 붙이지 말 것.`);

  if (sender.isMob || receiver.isMob) {
    부분.push(`[이름 없는 인물(직함) 규율]
- 직함은 외래어 없이, 한자어 지향의 단순한 보통명사 하나로(예 형식: 요리사·시녀·경비병 같은 결). 위치·구역 수식을 직함에 붙이지 않는다(장소 이야기는 본문에서).
${모브명단?.length ? `- 이 이야기에 이미 등장한 직함: ${모브명단.join(', ')} — 같은 역할이면 같은 표기를 그대로 쓴다. 새로운 역할만 새 직함을 만든다.` : ''}`);
  }

  부분.push(호칭과금지);
  부분.push(`[고유명사 표기 — 쓸 때는 반드시 이 표기로]\n${NAMES.join(', ')}`);

  부분.push(`[출력 JSON 구조] — 아래 키를 그대로, 설명·머리말 없이 JSON만:
{ "action": "send | draft | silence", "type": "letter", "title": "제목", "content": "편지 본문", "signature": "서명", "recipient_name": "수신인" }`);

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
function 행만들기(d, { storyId, sender, receiver, replyToId = null, forceWill = false, forceDraft = false }) {
  const action = 정리(d?.action).toLowerCase();
  if (action === 'silence') return null;
  const isDraft = forceDraft || action === 'draft' || 정리(d?.status).toLowerCase() === 'draft';
  let type = 정리(d?.type).toLowerCase();
  if (forceWill) type = 'will';
  if (!LETTER_TYPES.includes(type)) type = 'letter';

  let signature = 용어교정(정리(d?.signature));
  // 빙의 차단 — 서명이 발신자가 아닌 다른 등장 이름을 담으면 발신자 이름으로 교체.
  if (sender.타인이름?.some((n) => n && signature.includes(n))) signature = sender.name;
  if (!signature) signature = sender.name;
  if (sender.isMob) signature = 모브직함정리(signature);

  let recipient = 호칭정리(용어교정(d?.recipient_name)) || receiver.name;
  if (receiver.isMob) recipient = 모브직함정리(recipient);

  const content = 용어교정(정리(d?.content));
  if (!content) return null;

  return {
    story_id: storyId,
    sender_id: sender.id ?? null,
    receiver_id: receiver.id ?? null,
    sender_name: sender.isMob ? 모브직함정리(sender.name) : sender.name,
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
  const [{ characters: allChars }, { letters: storyLetters, error: dbErr }, context] =
    await Promise.all([
      sid ? listCharacters(sid) : Promise.resolve({ characters: [] }),
      listLetters(sid),
      맥락모으기(sid),
    ]);
  if (dbErr) return { error: `서신함이 아직 마련되지 않았습니다 — ${dbErr}` };

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
    const has = storyLetters.some((l) => l.type === 'will' && l.sender_name === dc.name);
    if (has) continue;
    const sender = { id: dc.char?.id ?? null, name: dc.name, 재료: 후보재료(dc, owner), isMob: false, 타인이름: [] };
    const receiver = { id: owner.id, name: owner.name, 재료: 약력문(owner), isMob: false };
    const prompt = buildLetterPrompt({
      sender, receiver,
      관계: dc.bond?.description || '',
      이전서신: 쌍이전서신문(ownerLetters, dc.char?.id ?? null, dc.name, owner.id, owner.name),
      지식: `[발신자가 아는 최근 소식]\n(없음 — 생전에 쓴 편지다.)`,
      최근유형: [], 모브명단,
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

  // ② 판별(Flash #1) — 거리·등장·공개 사건. 실패해도 안전 폴백으로 계속.
  const { cands: 판별, publicEvents } = await 판별하기(owner, candidates, context);

  // 함 주인의 '등장' 여부(주인은 보통 이야기의 중심 — 본인이 발신할 때의 지식 수위).
  const ownerAppeared = 판별.get(owner.name)?.appeared ?? true;

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

  if (pending) {
    // 응답자 = 원문의 수신자.
    const rIsOwner = pending.receiver_id === owner.id;
    const rName = rIsOwner ? owner.name : pending.recipient_name;
    const rCand = rIsOwner ? null : candidates.find((c) => c.name === rName);
    const rIsMob = !rIsOwner && !rCand; // 후보(인연·등록)에 없는 무명 = 모브
    const 응답가능 = rIsOwner || rIsMob || (rCand && rCand.kind !== 'deceased');
    if (응답가능) {
      const sender = rIsOwner
        ? { id: owner.id, name: owner.name, 재료: 약력문(owner), isMob: false }
        : rIsMob
          ? { id: null, name: rName, 재료: `이름 없는 인물 — 직함: ${rName}`, isMob: true }
          : { id: rCand.char?.id ?? null, name: rName, 재료: 후보재료(rCand, owner), isMob: false };
      const oIsOwner = pending.sender_id === owner.id;
      const oCand = oIsOwner ? null : candidates.find((c) => c.name === pending.sender_name);
      const receiver = oIsOwner
        ? { id: owner.id, name: owner.name, 재료: 약력문(owner), isMob: false }
        : oCand
          ? { id: oCand.char?.id ?? null, name: pending.sender_name, 재료: 후보재료(oCand, owner), isMob: false }
          : { id: null, name: pending.sender_name, 재료: `이름 없는 인물 — 직함: ${pending.sender_name}`, isMob: !pending.sender_id };
      const sJudge = 판별.get(sender.name) || { appeared: rIsOwner ? ownerAppeared : false };
      sender.타인이름 = allChars.map((c) => c.name).filter((n) => n && n !== sender.name);
      const prompt = buildLetterPrompt({
        sender, receiver,
        관계: (rCand?.bond?.description || oCand?.bond?.description || ''),
        이전서신: 쌍이전서신문(ownerLetters, sender.id, sender.name, receiver.id, receiver.name),
        지식: 지식블록(rIsMob ? false : sJudge.appeared, publicEvents, context),
        최근유형, 모브명단,
        replyTo: {
          senderName: pending.sender_name,
          title: pending.title,
          content: pending.content,
          canDraft: !draft답장.has(pending.id),
        },
      });
      const { data, error } = await callGeminiJSON(prompt, { temperature: 0.9, maxOutputTokens: 4000, thinkingBudget: 512, tag: '서신' });
      if (!error) {
        const row = 행만들기(data, { storyId: sid, sender, receiver, replyToId: pending.id });
        if (row) {
          const saved = await saveLetters([row]);
          if (saved.error) return { error: saved.error };
          return { added: saved.letters, kind: 'reply' };
        }
        // 침묵 → 신규 발신으로 넘어간다(설계서 §6 — 유저가 빈손이 안 되게).
      }
    }
  }

  // ④ 신규 발신 — 거리 가중 추첨으로 상대를 고른다(+모브 한 자리).
  const weighted = candidates.map((c) => ({
    cand: c,
    weight:
      c.kind === 'deceased'
        ? 고인가중치
        : 거리가중치[판별.get(c.name)?.distance || '나라'] || 거리가중치.나라,
  }));
  weighted.push({ cand: { kind: 'mob', name: null }, weight: 모브가중치 });
  const picked = 추첨(weighted);
  if (!picked) return { error: '편지를 주고받을 상대가 없습니다.' };
  const cand = picked.cand;

  // 사망·실종 인연이 뽑히면 = 母가 쓰는 부치지 못할 편지(보관함행) — 방향 고정.
  const isDead = cand.kind === 'deceased';
  // 역할 반전 — 함 주인이 발신자가 된다(40%). 모브는 주인에게 보내는 쪽이 기본.
  const ownerSends = isDead || (cand.kind !== 'mob' && Math.random() < 역할반전);

  let other;
  if (cand.kind === 'mob') {
    other = { id: null, name: null, 재료: '', isMob: true };
  } else {
    other = { id: cand.char?.id ?? null, name: cand.name, 재료: 후보재료(cand, owner), isMob: false };
  }
  const ownerSide = { id: owner.id, name: owner.name, 재료: 약력문(owner), isMob: false };
  const sender = ownerSends ? ownerSide : other;
  const receiver = ownerSends ? other : ownerSide;
  sender.타인이름 = allChars.map((c) => c.name).filter((n) => n && n !== sender.name);

  // 모브 발신자: 이름은 모델이 직함으로 짓는다 — 재료는 '주인의 생활권 익명 인물'이라는 처지만.
  if (sender.isMob) {
    sender.재료 = `이름 없는 인물 — ${owner.name}의 생활권(${owner.base || '거처'} 부근)에서 살아가는 평범한 사람이다. 직함(역할)을 하나 정해 그 사람으로서 쓴다. 수신자와는 일상 속에서 스치는 사이다.`;
    sender.name = '(직함)'; // 저장 시 서명에서 직함을 가져온다(아래 행만들기 후처리)
  }
  if (receiver.isMob) {
    receiver.재료 = `이름 없는 인물 — ${owner.name}의 생활권에서 살아가는 평범한 사람. 직함으로만 부른다.`;
    receiver.name = '(직함)';
  }

  // 발신자의 지식 수위: 주인이면 주인의 등장 여부, 모브면 소문 수위, 그 외엔 판별 결과.
  const sAppeared = sender.id === owner.id ? ownerAppeared : sender.isMob ? false : (판별.get(sender.name)?.appeared ?? false);

  const prompt = buildLetterPrompt({
    sender, receiver,
    관계: cand.kind === 'mob' ? '' : cand.bond?.description || '',
    이전서신: cand.kind === 'mob' ? '' : 쌍이전서신문(ownerLetters, other.id, cand.name, owner.id, owner.name),
    지식: 지식블록(sAppeared, publicEvents, context),
    최근유형, 모브명단,
    forceDraft: isDead,
  });
  const { data, error } = await callGeminiJSON(prompt, { temperature: 0.9, maxOutputTokens: 4000, thinkingBudget: 512, tag: '서신' });
  if (error) return { error };
  const row = 행만들기(data, { storyId: sid, sender, receiver, forceDraft: isDead });
  if (!row) return { error: '이번에는 아무도 붓을 들지 않았습니다 — 다시 시도하십시오.' };

  // 모브의 '(직함)' 자리 메우기 — 서명(발신)·수신인(수신)에서 실제 직함을 가져온다.
  if (sender.isMob) row.sender_name = 모브직함정리(row.signature) || '이름 모를 손';
  if (receiver.isMob && row.recipient_name === '(직함)') row.recipient_name = '이름 모를 손';

  const saved = await saveLetters([row]);
  if (saved.error) return { error: saved.error };
  return { added: saved.letters, kind: row.status === 'draft' ? 'draft' : 'new' };
}
