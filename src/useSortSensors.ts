// 드래그 정렬 공용 센서 — 카드/행 목록 전반(인물 명부·소지품·인연·문헌 목차)이 같은 손맛을 쓰게.
//  · 데스크탑(마우스): 8px 끌면 바로 집힘(PointerSensor).
//  · 모바일(터치): '꾹 눌렀다 끌기'(TouchSensor delay) — 그래야 같은 손가락으로 스크롤과 드래그가 공존한다.
//    누른 채 잠깐(아래 delay) 머물면 카드가 집히고, 그냥 쓸어내리면 평소대로 스크롤된다.
//  ⚠️ 이것만으론 부족 — 드래그 대상 요소에 CSS `touch-action: manipulation`(+ iOS 콜아웃/선택 차단)이
//     같이 있어야 브라우저가 손짓을 스크롤로 가로채지 않는다(styles.css의 .char-card/.item-card/.bond-row/.lore-vol).
import { PointerSensor, TouchSensor, useSensor, useSensors } from '@dnd-kit/core';

// 길게 눌러 집기 — delay는 '의도된 누름'이라 읽을 시간, tolerance는 그동안 허용되는 손떨림(넘으면 스크롤로 양보).
const 누름지연 = 220; // ms — 너무 짧으면 스크롤이 드래그로 오인됨, 너무 길면 답답함
const 손떨림허용 = 10; // px — 누르는 동안 이만큼 움직여도 드래그 의도로 본다(넉넉히 = 집기 쉬움)

export function useSortSensors() {
  return useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 누름지연, tolerance: 손떨림허용 } }),
  );
}
