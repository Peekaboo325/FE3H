// 이름 관련 유틸 (시스템 공용).

// 전체 성명에서 '첫 이름(퍼스트네임)'만 뽑는다.
//   "디미트리 알렉산드르 블레다드" → "디미트리"
//   "에델가르드 폰 흐레스벨그"      → "에델가르드"
//   "레아"                          → "레아"   (한 마디면 그대로)
//   빈 값 / 공백만                  → ""
export function firstName(fullName: string): string {
  return (fullName ?? '').trim().split(/\s+/)[0] ?? '';
}

// 이명 문자열을 쉼표로 나눠 배열로 (앞뒤 공백 제거, 빈 항목 버림).
//   "사자왕, 폭풍의 왕" → ["사자왕", "폭풍의 왕"]
//   ""                  → []
export function splitAliases(aliases?: string): string[] {
  return (aliases ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}
