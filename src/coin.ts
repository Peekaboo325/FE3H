// 화폐 표기 — 지갑은 속으로 '동화(銅) 정수 하나'로 저장하고, 보여줄 때만 층으로 굴린다(일상 설계 §5).
//  환율: 1 금화 = 100 은화 = 10,000 동화. 각 층 닢 수는 100 미만(100 모이면 윗 동전).
//  가격표는 단일 층(빵 동화 5닢), 지갑은 혼합 표기(금화 2닢 은화 30닢 동화 5닢).
export function 화폐표기(동화: number): string {
  const n = Math.max(0, Math.floor(Number(동화) || 0));
  const 금 = Math.floor(n / 10000);
  const 은 = Math.floor((n % 10000) / 100);
  const 동 = n % 100;
  const parts: string[] = [];
  if (금) parts.push(`금화 ${금}닢`);
  if (은) parts.push(`은화 ${은}닢`);
  if (동 || parts.length === 0) parts.push(`동화 ${동}닢`); // 지갑이 비면 '동화 0닢'
  return parts.join(' ');
}
