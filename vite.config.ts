import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// 브라우저(5173)에서 보낸 /api 요청을, 열쇠를 쥔 서버(8787)로 넘겨준다.
// 덕분에 클로드 API 열쇠는 브라우저에 노출되지 않는다.
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': 'http://localhost:8787',
    },
  },
});
