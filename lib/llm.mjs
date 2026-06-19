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
//  ⚠️ DeepSeek budget_tokens·effort 매핑은 '출발값'이다 — 실호출 로그(thinking 깊이·max_tokens)를 보고 튜닝.
//     (budget_tokens는 응답 max_tokens(8000) 미만으로 둔다. effort 'low'=가볍게 / 그 외=조금 더 깊게.)
export function 사고옵션(model, effort) {
  if (딥시크인가(model)) {
    return { thinking: { type: 'enabled', budget_tokens: effort === 'low' ? 2048 : 4096 } };
  }
  return { thinking: { type: 'adaptive' }, output_config: { effort } };
}
