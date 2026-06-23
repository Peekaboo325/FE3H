// 본문 생성 모델·사고 깊이 — 앱 '설정'에서 받은 값을 검증한다(임의 값 차단 + 기본값).
//  메인 본문 호출에만 쓴다. 기본 = Opus 4.8 / effort medium.
//  빌더가 앱 설정에서 DeepSeek V4 Pro(실험 선택지)로 고를 수 있다(CLAUDE.md §3). Sonnet은 2026-06 걷어냄.
const 모델허용 = new Set(['deepseek-v4-pro']); // ⚠️ Opus 잠깐 걷어둠(2026-06-19, 비용 사고) — 복구 시 'claude-opus-4-8' 다시 넣기

export function genConfig(body) {
  return {
    // 기본=DeepSeek. 옛 클라가 model:'claude-opus-4-8'을 보내도 허용목록에 없어 DeepSeek로 강제 전환(절대 Opus 안 탐).
    model: 모델허용.has(body?.model) ? body.model : 'deepseek-v4-pro',
    effort: body?.effort === 'low' ? 'low' : 'medium',
    // 후보정(Flash 교정 2차) — 명시적으로 false일 때만 끈다(기본 켬). DeepSeek 경로에서만 의미.
    polish: body?.polish !== false,
  };
}
