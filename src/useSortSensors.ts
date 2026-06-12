// 드래그 정렬 공용 센서 — 카드/행 목록 전반(인물 명부·소지품·인연·문헌 목차)이 같은 손맛을 쓰게.
//  · 데스크탑(마우스): 8px 끌면 바로 집힘(PointerSensor).
//  · 모바일(터치): '꾹 눌렀다 끌기'(TouchSensor delay) — 같은 손가락으로 스크롤과 드래그가 공존.
//  ⚠️ 드래그 대상 요소에는 ① CSS `touch-action: manipulation`(+ iOS 콜아웃/선택 차단, styles.css)과
//     ② 아래 `sortGuardProps`(스크롤 선점 차단)가 둘 다 있어야 모바일에서 실제로 끌린다.
import { useEffect } from 'react';
import { PointerSensor, TouchSensor, useSensor, useSensors } from '@dnd-kit/core';

// 길게 눌러 집기 — delay는 '의도된 누름'이라 읽을 시간, tolerance는 그동안 허용되는 손떨림(넘으면 스크롤로 양보).
const 누름지연 = 220; // ms — 너무 짧으면 스크롤이 드래그로 오인됨, 너무 길면 답답함
const 손떨림허용 = 10; // px — 누르는 동안 이만큼 움직여도 드래그 의도로 본다(넉넉히 = 집기 쉬움)

// ── 스크롤 선점 차단 가드(모바일 핵심) ──────────────────────────────────────
// iOS(웹킷)는 누름 초기의 몇 px 잔움직임만으로 스크롤을 '선점'하고, 한번 선점되면 그 손짓이 끝날 때까지
// 드래그 쪽에서 스크롤을 못 막는다(touchmove가 취소 불가가 됨) — "물건은 집혔는데 스크롤이 같이 끌려가
// 제자리"이던 원인. 스크롤이 맨 위/아래일 땐 선점할 스크롤이 없어 멀쩡했던 것도 이 때문.
// → 정렬 카드(data-sort-guard) 위에서 시작한 터치는, 손떨림 반경 안에서 움직이는 동안 touchmove를
//   선제적으로 막아 선점 자체를 차단한다. 반경을 확 넘으면(=스크롤 의도, 빠른 플릭) 즉시 비켜선다.
export const sortGuardProps = { 'data-sort-guard': '' } as const;

let 가드참조 = 0;
let 가드해제: (() => void) | null = null;

function installGuard() {
  let from: { x: number; y: number } | null = null;
  const start = (e: TouchEvent) => {
    from = null;
    if (e.touches.length !== 1) return; // 두 손가락(핀치 등)은 간섭 안 함
    const el = e.target instanceof Element ? e.target : (e.target as Node | null)?.parentElement;
    if (el?.closest('[data-sort-guard]')) {
      from = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    }
  };
  const move = (e: TouchEvent) => {
    if (!from || e.touches.length !== 1) return;
    const t = e.touches[0];
    if (Math.hypot(t.clientX - from.x, t.clientY - from.y) <= 손떨림허용) {
      if (e.cancelable) e.preventDefault(); // 스크롤 선점 차단 — 집기 끝나면 dnd-kit이 이어받는다
    } else {
      from = null; // 반경 밖 = 스크롤/드래그 본동작 — 가드는 손을 뗀다
    }
  };
  const end = () => {
    from = null;
  };
  document.addEventListener('touchstart', start, { capture: true, passive: true });
  document.addEventListener('touchmove', move, { capture: true, passive: false });
  document.addEventListener('touchend', end, { capture: true });
  document.addEventListener('touchcancel', end, { capture: true });
  return () => {
    document.removeEventListener('touchstart', start, { capture: true });
    document.removeEventListener('touchmove', move, { capture: true });
    document.removeEventListener('touchend', end, { capture: true });
    document.removeEventListener('touchcancel', end, { capture: true });
  };
}

export function useSortSensors() {
  // 가드는 문서당 한 벌(참조 세기) — 정렬 목록이 여러 개 떠도 리스너는 하나.
  useEffect(() => {
    if (가드참조++ === 0) 가드해제 = installGuard();
    return () => {
      if (--가드참조 === 0) {
        가드해제?.();
        가드해제 = null;
      }
    };
  }, []);
  return useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 누름지연, tolerance: 손떨림허용 } }),
  );
}
