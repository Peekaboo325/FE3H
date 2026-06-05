// 햄버거 드로어 메뉴 — 헤더의 ☰ 하나로 모든 메뉴를 연다.
// 항목이 늘어도 여기 목록에 한 줄만 추가하면 됨(헤더는 깔끔 유지).

export type MenuItem = { label: string; hint?: string; onClick: () => void };

export default function Menu({
  open,
  onClose,
  subtitle,
  items,
}: {
  open: boolean;
  onClose: () => void;
  subtitle?: string;
  items: MenuItem[];
}) {
  return (
    <>
      <div className={'drawer-bg' + (open ? ' show' : '')} onClick={onClose} />
      <nav className={'drawer' + (open ? ' open' : '')} aria-hidden={!open}>
        <div className="drawer-head">
          <div className="drawer-title">풍화설월</div>
          {subtitle && <div className="drawer-sub">{subtitle}</div>}
        </div>
        <div className="drawer-list">
          {items.map((it) => (
            <button
              key={it.label}
              className="drawer-item"
              onClick={() => {
                it.onClick();
                onClose();
              }}
            >
              <span className="drawer-label">{it.label}</span>
              {it.hint && <span className="drawer-hint">{it.hint}</span>}
            </button>
          ))}
        </div>
      </nav>
    </>
  );
}
