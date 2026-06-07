import type { ReactNode, MouseEvent } from 'react';

// 둥근 아이콘 버튼 — 모든 모달 상단·프로필 히어로에서 공용으로 쓰는 자산.
// 스타일은 .icon-btn 한 곳에서 정의. active=true면 금색 강조(.on).
export default function IconButton({
  children,
  onClick,
  label,
  active = false,
  className,
}: {
  children: ReactNode;
  onClick?: (e: MouseEvent<HTMLButtonElement>) => void;
  label: string; // aria-label + 툴팁(title)
  active?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      className={'icon-btn' + (active ? ' on' : '') + (className ? ' ' + className : '')}
      onClick={onClick}
      title={label}
      aria-label={label}
    >
      {children}
    </button>
  );
}
