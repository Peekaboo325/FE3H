// 본문 생성 모델·사고 깊이 — 앱 '설정'에서 받은 값을 검증한다(임의 값 차단 + 기본값).
//  메인 본문(Anthropic) 호출에만 쓴다. 기본 = Opus 4.8 / effort medium.
//  빌더가 앱 설정에서 Sonnet 4.6·low로 바꿀 수 있다(비용 절감 선택지 — 기본은 Opus, CLAUDE.md §3).
const 모델허용 = new Set(['claude-opus-4-8', 'claude-sonnet-4-6']);

export function genConfig(body) {
  return {
    model: 모델허용.has(body?.model) ? body.model : 'claude-opus-4-8',
    effort: body?.effort === 'low' ? 'low' : 'medium',
  };
}
