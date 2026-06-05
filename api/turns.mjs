// /api/turns — 지금까지 저장된 이야기를 불러온다 (화면을 켤 때 복원용).
// Supabase 미설정이면 빈 목록을 돌려준다(앱은 그대로 동작).

import { loadTurns } from '../lib/db.mjs';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.status(405).end('GET만 받습니다.');
    return;
  }
  let turns = [];
  try {
    turns = await loadTurns();
  } catch (e) {
    console.error('[보관소] /api/turns 오류:', e?.message || e);
  }
  res.status(200).setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify({ turns }));
}
