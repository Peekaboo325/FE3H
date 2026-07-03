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
  // DeepSeek V4 Pro — DeepSeek 공개가(입력=캐시미스 $0.435·캐시히트 $0.003625·출력 $0.87). 바뀌면 이 줄만.
  //  ⚠️ 피크·밸리: 피크 시간대(UTC 1–4·6–10 = 한국 10–13·15–19시)엔 '모든 항목 2배'. 서버가 피크분을 따로 집계해 아래서 가산.
  'deepseek-v4-pro': { label: 'DeepSeek V4 Pro', in: 0.435, cw: 0.435, cr: 0.003625, out: 0.87 },
};

// 피크 칸(*_peak)은 '피크 시간대에 쓴 토큰'의 부분집합(DeepSeek만). 그 부분에 1배를 더 얹어 2배를 만든다.
export type Tally = {
  calls: number;
  in: number;
  cw: number;
  cr: number;
  out: number;
  in_peak?: number;
  cw_peak?: number;
  cr_peak?: number;
  out_peak?: number;
};

function 토큰비용(r: Rate, t: { in: number; cw: number; cr: number; out: number }): number {
  return (t.in * r.in + t.cw * r.cw + t.cr * r.cr + t.out * r.out) / 1_000_000;
}

// 한 모델의 누적 토큰 → 추정 비용($). 단가표에 없는 모델은 0(토큰만 표시).
//  피크분(*_peak)이 있으면 그만큼 '1배'를 더 얹는다(피크=2배 = 평시 1배 + 가산 1배). DeepSeek 전용.
export function 비용(model: string, t: Tally): number {
  const r = RATES[model];
  if (!r) return 0;
  const base = 토큰비용(r, t);
  const 피크가산 = 토큰비용(r, {
    in: t.in_peak || 0,
    cw: t.cw_peak || 0,
    cr: t.cr_peak || 0,
    out: t.out_peak || 0,
  });
  return base + 피크가산;
}

export function 라벨(model: string): string {
  return RATES[model]?.label || model;
}
