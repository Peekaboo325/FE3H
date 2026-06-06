// 입력에 앵커("N화 참고" / "제N권·(제목) 참조")가 있는지 가볍게 감지한다.
// 로딩을 '회상' 톤으로 바꿀지 정하는 용도(즉각 피드백). 실제 해석·주입은 서버가 한다.
export function hasAnchor(text: string): boolean {
  if (!text) return false;
  return (
    /\d+\s*화\s*(?:참고|참조)/.test(text) || // N화 참고 (범위·다중 포함)
    /제\s*\d+\s*(?:권|장)\s*(?:참고|참조)/.test(text) || // 제N권 참조
    /\([^)]+?\s*(?:참고|참조)\)/.test(text) // (제목 참조)
  );
}
