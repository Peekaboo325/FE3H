// 본문 서술자(메인 본문) 호출 — 모델 제공자에 맞춰 클라이언트·키·사고 옵션을 고른다.
//  Opus·Sonnet = Anthropic. DeepSeek V4 Pro = 'Anthropic 호환' 엔드포인트로 같은 SDK를 그대로 재활용해 부른다
//  (https://api.deepseek.com/anthropic — 메시지 포맷·스트리밍이 Anthropic과 동일하므로 baseURL만 갈아끼우면 됨).
//  ⚠️ CLAUDE.md §3: 본문 기본은 Opus(수빈 기준선). DeepSeek은 빌더가 앱 설정에서 고르는 '실험 선택지'다 — Opus를 들어내는 게 아님.
import Anthropic from '@anthropic-ai/sdk';

const DEEPSEEK_BASE = 'https://api.deepseek.com/anthropic';
const 딥시크인가 = (model) => String(model || '').startsWith('deepseek');

// 모델 제공자에 맞는 API 키(서버 환경변수). 키 없으면 undefined → 호출부가 안내.
export function 서술자키(model) {
  return 딥시크인가(model) ? process.env.DEEPSEEK_API_KEY : process.env.ANTHROPIC_API_KEY;
}

// 본문 스트리밍용 클라이언트. DeepSeek은 baseURL만 Anthropic 호환 엔드포인트로 갈아끼운다.
export function 서술자클라이언트(model) {
  if (딥시크인가(model)) {
    return new Anthropic({ apiKey: process.env.DEEPSEEK_API_KEY, baseURL: DEEPSEEK_BASE });
  }
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
}

// 사고(thinking) 옵션 — 클로드는 adaptive + effort(앱 설정), DeepSeek은 표준 Anthropic thinking 'enabled'.
//  ⚠️ DeepSeek은 사고가 본디 상시 ON이라 앱의 effort 토글을 비활성화했다(Settings) → effort와 무관하게 고정 예산.
//     budget_tokens는 응답 max_tokens(8000) 미만. 깊이를 더/덜 원하면 이 값만 운영 중 튜닝.
export function 사고옵션(model, effort) {
  if (딥시크인가(model)) {
    return { thinking: { type: 'enabled', budget_tokens: 4096 } };
  }
  return { thinking: { type: 'adaptive' }, output_config: { effort } };
}

// ── DeepSeek 한정 '본문 절제 보정' 지침 ──────────────────────────────────────
//  DeepSeek은 감정·의미를 '해설'로 한 겹 더 풀어 쓰는 경향이 있어(실측), 이 블록을 시스템 끝에 덧대 조인다.
//  ⚠️ Opus엔 안 붙는다(이미 절제돼 있어, 과교정하면 임상적으로 식음). 모델별지침()이 모델에 맞춰 켠다.
//  ※ 빌더 채택본(2026-06: GPT 제안의 과(過)금지를 누그러뜨림 — 단어 통삭제가 아니라 '구문' 저격, 내면은 전무가 아니라 희소 허용).
const DEEPSEEK_보정 = `[본문 절제 보정 — 이 서술자 한정]
초안을 쓴 뒤 아래로 한 번 더 조인다. 교정 설명은 출력에 쓰지 말고 최종 원고만 낸다.
- 감정·동기·관계 변화를 해설 문장으로 결론짓지 마라. 특히 '~의 증거였다 / ~하기 위함이었다 / ~이기도 했다 / ~라는 뜻이었다 / 그는 사실 ~하고 있었다' 같은 해석 코다는 지우고, 행동·시선·사물의 상태로 바꾼다. (단어가 아니라 이 '구문'을 지운다 — '그것은' 같은 멀쩡한 주어는 그대로 둬도 된다.)
- 결말은 해석이 아니라 행동·시선·침묵·사물의 상태로 끝낸다. 이미 장면으로 드러난 뜻을 마지막 문단에서 다시 풀이하지 마라.
- 같은 감정·결정·회피를 여러 문단에 걸쳐 다른 말로 재확인하지 마라 — 가장 강한 장면 하나만 남긴다.
- 시점 인물의 시야를 벗어나지 마라. 그가 보고·듣고·보고받고·떠올린 것만 쓰고, 타인의 속내는 단정하지 않는다.
- 차갑게 유지한다. 비유는 절제하고 상징을 설명하지 마라. 감정이 커질수록 문장은 짧아진다.
- 내면을 직접 고백시키지 마라('보고 싶었다·두려웠다·후회했다·흔들렸다') — 손의 움직임·시선의 방향·멈춘 발걸음·접힌 종이·닫힌 문·식은 찻잔처럼 관찰 가능한 것으로 드러낸다. 단, 정 필요하면 장면당 많아야 한 줄, 감정의 경첩에서만 절제해 허용한다(전무가 아니라 희소).
- 핵심 사물이 반복되면 반복은 두되, 매번 같은 뜻으로 풀이하지 말고 배치만 바꾼다.`;

// 모델 전용 추가 시스템 블록(있을 때만). 시스템 배열 끝에 펼쳐 붙인다: [...system, ...모델별지침(model)]
export function 모델별지침(model) {
  return 딥시크인가(model) ? [{ type: 'text', text: DEEPSEEK_보정 }] : [];
}
