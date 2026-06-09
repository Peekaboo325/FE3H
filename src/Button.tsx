import type { ReactNode, MouseEvent } from 'react';

// 공용 텍스트/동작 버튼 — IconButton의 텍스트 버전.
//  여기 한 곳에 '버튼 규칙'을 박는다 → 새 버튼은 이걸 쓰기만 하면 자동으로:
//   · 크기 고정: loading이어도 라벨 자리를 그대로 두고 스피너만 겹쳐 띄움 → 폭 절대 안 변함.
//   · 일관 모양: 알약형. variant='primary'(금빛 인장) / 'secondary'(차분, 기본).
//  ⚠️ 라벨은 호출부가 UI 사전(src/strings.ts)에서 꺼내 넣는다(직접 타이핑 금지, CLAUDE.md §1).
//  ⚠️ 새 동작 버튼은 직접 <button>+CSS 짜지 말고 이걸 쓴다(아이콘만이면 IconButton).
export default function Button({
  children,
  onClick,
  variant = 'secondary',
  loading = false,
  disabled = false,
  type = 'button',
  className,
}: {
  children: ReactNode;
  onClick?: (e: MouseEvent<HTMLButtonElement>) => void;
  variant?: 'primary' | 'secondary';
  loading?: boolean;
  disabled?: boolean;
  type?: 'button' | 'submit';
  className?: string;
}) {
  return (
    <button
      type={type}
      className={`btn btn--${variant}` + (className ? ' ' + className : '')}
      onClick={onClick}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
    >
      {/* 라벨은 항상 자리를 차지(로딩 땐 숨김만) → 버튼 폭이 텍스트 길이에 고정, 스피너로 안 흔들림 */}
      <span className="btn-label" style={loading ? { visibility: 'hidden' } : undefined}>
        {children}
      </span>
      {loading && <span className="spinner btn-spinner" aria-label="처리 중" />}
    </button>
  );
}
