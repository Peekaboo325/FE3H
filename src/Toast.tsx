import type { ReactNode } from 'react';

// 공용 토스트 — 화면 상단 가운데 알약 알림(기록 완료·보고서 갱신 등).
//  표시 여부·자동 소멸은 호출부가 상태로 제어한다(예: setSaved(true) 후 setTimeout으로 false).
//  ⚠️ 새 토스트는 직접 div 짜지 말고 이걸 쓴다.
export default function Toast({ children }: { children: ReactNode }) {
  return (
    <div className="toast" role="status">
      {children}
    </div>
  );
}
