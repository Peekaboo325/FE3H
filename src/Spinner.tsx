// 목록·패널 로딩 표시 — 가운데 스피너만(공용 자산).
//  ⚠️ 문구를 얹지 않는다 — 로딩엔 스피너 외 아무 글자도 쓰지 않기로 확정(빌더 결정).
export default function Spinner() {
  return (
    <div className="loading-block">
      <span className="spinner spinner-lg" />
    </div>
  );
}
