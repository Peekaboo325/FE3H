import type { ReactNode } from 'react';
import { X, ArrowLeft } from 'lucide-react';
import IconButton from './IconButton';
import { UI } from './strings';

// 공용 모달 셸 — 백드롭(바깥 클릭=닫기) + 박스 + 표준 헤더(제목 + (뒤로) + X + 아래 구분선).
//  여기 한 곳에 '모달 규칙'을 박는다 → 새 모달은 이걸 쓰기만 하면 헤더·구분선·닫기가 자동으로 일치.
//  본문은 children(경고문·.modal-body·푸터 등 그대로). 변형은 className(modal--list/--chronicle/--import…).
//  ⚠️ 새 모달은 `.modal-bg`/`.modal-head`를 직접 복붙하지 말고 이걸 쓴다(CLAUDE.md §1 모달 표준).
//  복잡한 2단/히어로 모달(Characters·Lore)은 자체 레이아웃이라 예외 — 그건 별도.
export default function Modal({
  onClose,
  title,
  onBack,
  className,
  children,
}: {
  onClose: () => void;
  title?: ReactNode; // 있으면 표준 헤더를 그린다(없으면 헤더 없음)
  onBack?: () => void; // 있으면 헤더 좌측에 ← (목록/뒤로). 제목은 가운데라 ←가 있든 없든 안 밀림.
  className?: string; // .modal 변형
  children: ReactNode;
}) {
  return (
    <div className="modal-bg" onClick={onClose}>
      <div className={'modal' + (className ? ' ' + className : '')} onClick={(e) => e.stopPropagation()}>
        {title != null && (
          <div className="modal-head">
            <div className="head-side">
              {onBack && (
                <IconButton label="뒤로" onClick={onBack}>
                  <ArrowLeft size={17} />
                </IconButton>
              )}
            </div>
            <h2>{title}</h2>
            <div className="head-actions">
              <IconButton label={UI.close} onClick={onClose}>
                <X size={17} />
              </IconButton>
            </div>
          </div>
        )}
        {children}
      </div>
    </div>
  );
}
