// 전역 토스트 — 유저에게 가는 '가벼운 알림'의 단일 통로(성공·실패·정보 전부).
//  명령형 API라 어디서든 `showToast('…')` 한 줄로 띄운다(컴포넌트 상태 불필요).
//  루트에 <ToastHost/> 하나만 두면 그 위에 그려진다(dialog.tsx와 같은 구조).
//  ⚠️ 새 알림은 인라인 글씨·브라우저 alert를 쓰지 말고 반드시 이걸 쓴다.
//  (예외 — '되돌릴 수 없는 확인'은 confirmAsk(다이얼로그), DB 미연결 등 패널 안내는 .warn 인라인.)

import { useEffect, useState } from 'react';

type Item = { id: number; text: string };
let pushFn: ((text: string) => void) | null = null;
let seq = 0;

export function showToast(text: string) {
  pushFn?.(String(text ?? '').trim());
}

export function ToastHost() {
  const [items, setItems] = useState<Item[]>([]);
  useEffect(() => {
    pushFn = (text) => {
      if (!text) return;
      const id = ++seq;
      setItems((xs) => [...xs, { id, text }]);
      window.setTimeout(() => setItems((xs) => xs.filter((i) => i.id !== id)), 2800);
    };
    return () => {
      pushFn = null;
    };
  }, []);
  if (!items.length) return null;
  return (
    <div className="toast-host">
      {items.map((i) => (
        <div key={i.id} className="toast" role="status">
          {i.text}
        </div>
      ))}
    </div>
  );
}
