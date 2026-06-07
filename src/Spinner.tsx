// 목록·패널 로딩 표시 — 가운데 스피너 + 디제틱 문구(공용 자산).
export default function Spinner({ label = '펼치는 중…' }: { label?: string }) {
  return (
    <div className="loading-block">
      <span className="spinner spinner-lg" />
      {label && <span className="loading-label">{label}</span>}
    </div>
  );
}
