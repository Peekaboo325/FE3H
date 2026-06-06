// 이야기 기본 제목 = '운명의 장' + 로마숫자 (운명의 장 Ⅰ, Ⅱ, Ⅲ …)
// 디제틱: 세이브 슬롯도 포드라 안의 '운명의 장'으로 위장.

// 정수를 로마숫자로. (1~3999 범위면 충분 — 그 이상은 그냥 숫자로 흘려보냄)
export function roman(n: number): string {
  if (!Number.isFinite(n) || n < 1 || n > 3999) return String(n);
  const table: [number, string][] = [
    [1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'],
    [100, 'C'], [90, 'XC'], [50, 'L'], [40, 'XL'],
    [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I'],
  ];
  let out = '';
  for (const [v, sym] of table) {
    while (n >= v) {
      out += sym;
      n -= v;
    }
  }
  return out;
}

export function defaultStoryTitle(n: number): string {
  return `운명의 장 ${roman(n)}`;
}
