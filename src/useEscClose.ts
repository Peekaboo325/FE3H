import { useEffect, useRef } from 'react';

// ESC 한 번 = 맨 위 '한 겹'만 닫기.
//  열린 겹(모달·다이얼로그·크롭 등)이 스스로 이 훅을 부르면 모듈 스택에 쌓이고,
//  ESC는 항상 마지막에 열린 겹의 닫기만 부른다 — 패널 위 다이얼로그가 같이 닫히는 사고 방지.
//  입력 칸(input/textarea/select·contentEditable)에 포커스가 있을 땐 닫지 않는다
//  (개칭 취소처럼 칸 자신의 ESC 동작이 우선).
//  ⚠️ 새 오버레이를 만들면 직접 keydown을 달지 말고 이 훅을 쓴다.
const 스택: { fn: () => void }[] = [];
let 청취중 = false;

function onKey(e: KeyboardEvent) {
  if (e.key !== 'Escape' || !스택.length) return;
  const t = e.target as HTMLElement | null;
  if (
    t &&
    (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)
  )
    return;
  e.preventDefault();
  스택[스택.length - 1].fn();
}

export default function useEscClose(close: () => void, active = true) {
  const ref = useRef(close);
  ref.current = close; // 항상 최신 닫기 동작을 잡는다(재등록 없이)
  useEffect(() => {
    if (!active) return;
    const entry = { fn: () => ref.current() };
    스택.push(entry);
    if (!청취중) {
      document.addEventListener('keydown', onKey);
      청취중 = true;
    }
    return () => {
      const i = 스택.indexOf(entry);
      if (i >= 0) 스택.splice(i, 1);
    };
  }, [active]);
}
