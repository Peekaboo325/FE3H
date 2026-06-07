import type { ReactNode, MouseEvent } from 'react';

// 둥근 아이콘 버튼 — 프로필 히어로 상단·모달 헤더 등에서 공용으로 쓰는 자산.
// 스타일은 .icon-btn (= .hero-btn과 동일 규칙). active=true면 금색 강조(.on).
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
