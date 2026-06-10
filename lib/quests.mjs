// ─────────────────────────────────────────────────────────────────────────
//  임무 장부 발급소 — Gemini Flash가 인물이 '스스로 꾸미는 계획' 5~7개를 짓는다.
//
//  legacy(v1.0)의 퀘스트를 이식한 것. 핵심 설계는 그대로 가져왔다:
//   · 인물은 유저에게 일을 맡기는 NPC가 아니라, 제 일을 제가 독백하는 실행자.
//   · 보상 = 게임식 재화가 아니라 '행위 뒤에 남는 잔여물'(물건·감각·관계·깨달음).
//  단 프롬프트는 v2.0 결(규칙·금지 중심, few-shot 없이)로 새로 썼다.
//
//  보고서(report.mjs)와 같은 결의 Gemini 몫이지만 발급은 따로 한다(임무만 재작성 가능).
//  저장은 characters.analysis(jsonb) 안의 quests 칸 — 스키마 변경 없음.
//  ⚠️ SYSTEM(박제 세계관)은 여기에도 넣지 않는다(CLAUDE.md §3). 단 고유명사
//     '표기 목록'(NAMES — 가벼운 한글 명단)만은 보상 풍미용으로 주입한다(빌더 승인 예외).
// ─────────────────────────────────────────────────────────────────────────

import { getCharacter, setCharacterAnalysis } from './db.mjs';
import { callGeminiJSON, 약력문, 맥락모으기 } from './report.mjs';
import { NAMES } from './worldview.mjs';

const QUEST_TYPES = ['의무', '야망', '교류', '휴식', '돌발'];

// 임무 장부 프롬프트(한국어 출력). 약력·맥락을 읽고 JSON으로.
export function buildQuestsPrompt(char, { context } = {}) {
  return `너는 포드라의 '왕실 분석관'이다. 인물 "${char.name}"의 임무 장부를 발급하라.
임무 = 이 인물이 지금 시점에 스스로 세우는 계획. 5~7개를 만든다.
출력은 모두 자연스러운 한국어(올바른 띄어쓰기·문법)로 쓴다.

[약력]
${약력문(char)}
(중요: 게임 원작 설정보다 위 커스텀 약력을 우선한다.)

[최근 맥락]
${context || '(아직 쌓인 본문이 없다 — 약력과 설정에 충실하게 짓는다.)'}

[임무 규칙]
- 주체: 이 인물 본인이 직접 결심하고 실행하는 일만 적는다. 남(특히 유저·교사)에게 부탁·의뢰·요청하는 문장은 금지 — "~해줘"·"~해주게"·"~부탁한다" 류의 종결이 나오면 실패다. 인물은 의뢰인이 아니라 실행자다.
- 상황 적응: 최근 맥락이 전쟁·위기·갈등이면 의무·돌발 쪽을 많이, 평화·축제·일상이면 교류·휴식 쪽을 많이 만든다. 단 그중 1개는 현재 흐름과 어긋나는 마찰을 일으키는 임무로 두어 복잡성을 유지한다.
- 지목: 설명 안에 구체적인 이름(인물·장소·물건)을 적어 의도를 땅에 붙인다. 최근 맥락에 등장한 이름을 우선한다.
- type: ${QUEST_TYPES.join('·')} 중 하나.
- name(제목): 한국어 명사형 종결, 15자 이내.
- description(설명): 1인칭 속마음 독백 한 문장, 70자 이내. 결심·계획의 어미로 끝낸다(~해야겠어 / ~할까 / ~하는 게 좋겠군 / ~인지 확인해보자 / ~해두자 결). 배경 설명을 늘어놓지 말고 '내 계획' 자체에 집중한다.
- reward(보상): 그 일을 치른 '뒤에 남는 것' 하나를 짧은 명사구로. 종류는 네 갈래를 섞는다 — 손에 들어온 물건·음식(잦게), 몸에 남는 감각이나 상태(잦게), 얻어낸 정보·비밀·상대의 반응(가끔), 내면의 깨달음(드물게). '경험치'·'골드' 같은 게임식 보상은 금지.
- 보상 서너 개 중 하나꼴로 아래 [고유명사 표기]의 단어를 자연스럽게 녹인다(전부 쓰려 들지 말 것, 억지 결합 금지).
- [TYPE:A] 같은 시스템 태그·괄호 표식을 출력 문자열에 남기지 말 것.

[고유명사 표기]
${NAMES.join(', ')}

[출력 JSON 구조] — 아래 키를 그대로, 설명·머리말 없이 JSON만:
{ "quests": [ { "type": "의무", "name": "제목", "description": "1인칭 독백", "reward": "보상" } ] }`;
}

// LLM 출력의 들쭉날쭉함을 다듬어 화면이 믿고 쓸 수 있는 모양으로 고정한다.
function normalizeQuests(d) {
  const 정리 = (s) => String(s ?? '').replace(/[[\]【】]/g, '').replace(/\s{2,}/g, ' ').trim();
  const arr = Array.isArray(d?.quests) ? d.quests : [];
  return arr
    .map((q) => ({
      type: QUEST_TYPES.includes(정리(q?.type)) ? 정리(q.type) : '돌발',
      name: 정리(q?.name),
      description: 정리(q?.description),
      reward: 정리(q?.reward),
    }))
    .filter((q) => q.name && q.description)
    .slice(0, 7);
}

// 발급 오케스트레이터 — 인물·맥락을 모아 임무 장부를 짓고 analysis.quests에 새긴다.
//  엔드포인트(api/server)는 이 한 함수만 부른다.
export async function runQuests({ characterId, storyId } = {}) {
  if (!characterId) return { error: '인물 지목이 없습니다.' };
  const char = await getCharacter(characterId);
  if (!char) return { error: '인물을 찾을 수 없습니다.' };

  const sid = storyId || char.story_id || null;
  const context = await 맥락모으기(sid);

  const prompt = buildQuestsPrompt(char, { context });
  // 임무는 보고서보다 작은 창작 — thinking 짧게, 출력 한도도 작게.
  const { data, error } = await callGeminiJSON(prompt, {
    temperature: 0.9,
    maxOutputTokens: 4000,
    thinkingBudget: 1024,
    tag: '임무',
  });
  if (error) return { error };

  const quests = normalizeQuests(data);
  if (!quests.length) return { error: '임무를 한 건도 받지 못했습니다 — 다시 시도하십시오.' };

  // 보고서 등 기존 analysis 살림은 그대로 두고 quests 칸만 갈아 끼운다.
  const merged = { ...(char.analysis || {}), quests, quests_at: new Date().toISOString() };
  const save = await setCharacterAnalysis(characterId, merged);
  if (save.error) return { error: save.error };
  return { report: merged };
}
