// /api/turns — 지금까지 저장된 이야기를 불러온다 (화면을 켤 때 복원용).
// 진단 정보도 함께 돌려준다:
//   dbReady : Supabase 열쇠가 서버에 잡혔는지 (false면 키 누락/이름오타/미배포)
//   error   : 연결은 됐는데 막혔을 때의 사유 (예: 표 없음, 권한 막힘)

import { loadTurns, dbReady } from '../lib/db.mjs';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.status(405).end('GET만 받습니다.');
    return;
  }
  let result = { turns: [], error: null };
  try {
    result = await loadTurns();
  } catch (e) {
    result = { turns: [], error: e?.message || String(e) };
  }
  res.status(200).setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify({ dbReady: dbReady(), turns: result.turns, error: result.error }));
}
