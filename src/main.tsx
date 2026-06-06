import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles.css';

// iOS 웹앱 키보드 대응: '지금 실제로 보이는 높이'를 CSS 변수(--app-height)로 박는다.
// 100dvh는 iOS 전체화면 웹앱에서 키보드가 뜰 때 줄었다가 닫혀도 원복이 안 되는 버그가 있어,
// VisualViewport가 알려주는 실측 높이로 페이지 높이를 직접 제어한다(닫으면 즉시 원복).
const vv = window.visualViewport;
if (vv) {
  const apply = () => {
    // 보이는 영역의 높이 + 위치(키보드로 창이 밀릴 때의 offset)를 둘 다 추적한다.
    document.documentElement.style.setProperty('--app-height', `${vv.height}px`);
    document.documentElement.style.setProperty('--app-top', `${vv.offsetTop}px`);
  };
  apply();
  vv.addEventListener('resize', apply);
  vv.addEventListener('scroll', apply);
}

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
