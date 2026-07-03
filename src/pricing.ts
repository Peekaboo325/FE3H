// API 단가표 — 한 곳에 모은다(빌더 진단용). 단가가 바뀌면 이 표의 숫자만 고치면 된다.
//  ⚠️ API는 '돈'이 아니라 '토큰'만 준다 → 여기서 토큰 × 단가로 금액을 '추정'한다(정산서가 아님).
//  단위 = 미화 $/100만 토큰. 캐시 칸(cw=쓰기·cr=읽기)은 클로드/딥시크만 유효, Gemini는 캐시가 없다.

export type Rate = { label: string; in: number; cw: number; cr: number; out: number };

export const RATES: Record<string, Rate> = {
  // Claude — platform.claude.com 공개가(확정). 캐시 쓰기 1.25×·읽기 0.10×.
  'claude-opus-4-8': { label: 'Opus 4.8', in: 5, cw: 6.25, cr: 0.5, out: 25 },
  'claude-sonnet-4-6': { label: 'Sonnet 4.6', in: 3, cw: 3.75, cr: 0.3, out: 15 },
  'claude-haiku-4-5': { label: 'Haiku 4.5', in: 1, cw: 1.25, cr: 0.1, out: 5 },
  // Gemini — 다른 앱 실측으로 역산 확인(입력 $0.30·출력 $2.50 → $0.0352 일치). 캐시 없음.
  'gemini-2.5-flash': { label: 'Gemini Flash', in: 0.3, cw: 0.3, cr: 0.3, out: 2.5 },
  // DeepSeek — DeepSeek 공개가(캐시 적중가 별도). 바뀌면 이 줄만 수정.
  'deepseek-v4-pro': { label: 'DeepSeek V4 Pro', in: 0.27, cw: 0.27, cr: 0.07, out: 1.1 },
};

export type Tally = { calls: number; in: number; cw: number; cr: number; out: number };

// 한 모델의 누적 토큰 → 추정 비용($). 단가표에 없는 모델은 0(토큰만 표시).
export function 비용(model: string, t: Tally): number {
  const r = RATES[model];
  if (!r) return 0;
  return (t.in * r.in + t.cw * r.cw + t.cr * r.cr + t.out * r.out) / 1_000_000;
}

export function 라벨(model: string): string {
  return RATES[model]?.label || model;
}
