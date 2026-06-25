import { useRef, useLayoutEffect } from 'react';

// 내용 높이에 맞춰 상한 없이 자라는 textarea — 수정 화면이 출력 크기를 유지한다(rows 고정으로 쪼그라들지 않음).
//  CSS(.turn-edit textarea)는 overflow:hidden·max-height 없음 → 여기서 height를 scrollHeight로 맞춘다.
//  ⚠️ height='auto'로 재는 순간 칸이 접혀 .scroll 높이가 출렁 → 매 입력마다 스크롤 널뛰기.
//   재기 직전 바깥(.scroll) 스크롤 위치를 붙잡았다 되돌린다(iOS 커서-키보드 붙음 회피).
export default function AutoTextarea({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const sc = document.querySelector('main.scroll');
    const prev = sc ? sc.scrollTop : 0;
    el.style.height = 'auto';
    el.style.height = el.scrollHeight + 'px';
    if (sc && sc.scrollTop !== prev) sc.scrollTop = prev;
  }, [value]);
  return <textarea ref={ref} value={value} onChange={(e) => onChange(e.target.value)} />;
}
