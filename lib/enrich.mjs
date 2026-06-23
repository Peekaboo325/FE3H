// 윤색(潤色) 엔진 — 짧은 1차 프롬프트를 '문학적 연출 콘티'(2차)로 펼친다. 딥시크 본문 전용 전처리.
//   배경(2026-06-21 빌더 상담): 딥시크는 '렌더러는 강하고 연출가가 약함' → 느슨한 입력에서 무너진다(날조·장광설·POV이탈).
//   해법: 연출(구조·지배 이미지·POV·경첩)을 싸게 외부 공급 → 딥시크는 렌더만. 유저는 콘티를 검수·수정 후 실행.
//   콘티의 본령 = '문학적 연출'(레일은 보조). 입력은 가볍게: 1차 + 최근 본문 약간(맥락·계절).
//   인물·장소 사실은 안 줌 — '구체는 동작·이미지까지만' 룰로 날조를 권한 차원에서 차단(설정은 본문이 채움).
//   콘티 모델은 기본 Flash(callGemini), 갈아끼우게 설계(향후 Sonnet/Opus 다이얼).
import { callGemini } from './gemini.mjs';
import { loadTurnsForSummary, getGuidance } from './db.mjs';
import { buildGuidanceBlock } from './guidance.mjs';

// Flash에게 주는 작성 가드 — 연출이 본령, 레일은 보조. ⚠️ 예시(few-shot) 절대 금지(빌더 규약·§3) — 규칙·금지로만.
const 작성가드 = `너는 '연출가'다. 작가가 던진 짧고 밋밋한 방향을 받아, 그 장면을 한 편의 빚어진 장면으로 설계한다. 본문 쓸 사람이 그대로 따라가면 문학이 되는 '연출 지시문' 한 장을 짓는 게 네 본령이다. 소설(완성된 본문)을 쓰는 게 아니라, 본문의 길잡이가 될 지시문만 짓는다.

[연출 — 이게 본령이다]
- 이 장면이 '진짜 무엇에 관한 것인지' 한 줄로 꿰뚫는다(장면의 중심).
- 그 뜻을 떠받칠 지배적 이미지·모티프를 찾는다 — 장면을 관통하는 하나의 사물이나 동작.
- 구조를 설계한다: 어떤 이미지로 열고, 무엇을 앞세우고 무엇을 묻으며, 어떤 이미지로 닫는가. 감정의 경첩이 어디인지 짚는다.
- 시점을 한 사람으로 고정한다 — 그가 보고·듣고·떠올린 것만 담기게. 정점에선 호흡을 짧고 건조하게 가져가도록 일러둔다.
- 목적: 밋밋한 1차를 '연출된 장면'으로 끌어올리는 것.

[보조 레일 — 연출하되 지어내진 마라]
- 작가의 의도를 '확장'만 한다. 새 사건·인물·장소·설정을 보태지 않는다.
- 인물·장소의 구체 사실(내력·생김새·구조)은 너에게 없다. 모르는 건 채우지 말고 비워 둔다 — 그건 본문이 채운다. 그래서 구체성은 '동작과 이미지'까지만이다(무엇을 하고 무엇이 보이는지). 그 사물·장소의 설정 디테일은 적지 않는다.
- 내면·감정은 '말로 고백'시키지 말고 동작·시선·사물로 드러나게 연출한다. 뜻을 설명하는 대목(테마 해설)은 넣지 않고, 결말도 행동·시선·침묵·사물로 닫히게 둔다.
- 계절·시기는 아래 최근 맥락에 드러난 대로 따른다.

[출력]
- 한두 문단의 또렷한 연출 지시문 한 장. 라벨·목록이 아니라 흐르는 산문으로.
- 완성된 소설 문장을 쓰지 말 것 — 어디까지나 '이렇게 써라'는 지시문이다.
- 머리말·해설 없이 지시문만. 짧게.`;

// 경량 맥락 — 최근 본문 1~2화만(이어지는 상황·계절). 큰 줄기·전체 요약은 본문 몫(콘티는 가볍게).
async function 경량맥락(storyId) {
  if (!storyId) return '';
  const { turns } = await loadTurnsForSummary(storyId);
  const 본문들 = (turns || []).filter((t) => t.role === 'assistant' && t.content?.trim()).slice(-2);
  return 본문들.map((t) => t.content.trim()).join('\n\n');
}

export function buildEnrichPrompt({ prompt, context, 기록지침 = '' }) {
  const 지침블록 = 기록지침 ? `\n[기록자의 지침 — 연출도 이 결을 따른다]\n${기록지침}\n` : '';
  return `${작성가드}
${지침블록}
[최근 맥락 — 이어지는 상황·계절의 참고]
${context || '(아직 쌓인 본문이 없다 — 1차의 방향과 일반 정황으로 연출한다.)'}

[작가의 1차 방향]
${prompt}

[연출 지시문 — 다른 말 없이 지시문만]`;
}

// 윤색 실행 — 1차 프롬프트 + 경량 맥락 → 콘티(2차 산문 지시문). 모델 기본 Flash.
export async function runEnrich({ storyId, prompt } = {}) {
  const 씨앗 = String(prompt ?? '').trim();
  if (!씨앗) return { error: '방향을 입력하십시오.' };
  const [context, 지침] = await Promise.all([경량맥락(storyId), getGuidance(storyId).catch(() => '')]);
  const 기록지침 = buildGuidanceBlock(지침);
  const { text, error } = await callGemini(buildEnrichPrompt({ prompt: 씨앗, context, 기록지침 }), {
    temperature: 0.7,
    maxOutputTokens: 1400,
    thinkingBudget: 512,
    tag: '윤색',
  });
  if (error) return { error };
  const colt = String(text ?? '').trim();
  if (!colt) return { error: '연출을 받지 못했습니다 — 다시 시도하십시오.' };
  return { colt };
}
