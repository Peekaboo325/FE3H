// /api/turns?story_id=123 — 그 이야기의 본문을 불러온다 (화면 복원용).
//   dbReady : Supabase 열쇠가 서버에 잡혔는지
//   error   : 막혔을 때 사유 (표 없음 / 권한 등)

import { loadTurns, dbReady } from '../lib/db.mjs';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.status(405).end('GET만 받습니다.');
    return;
  }
  const storyId = req.query?.story_id ? Number(req.query.story_id) : null;
  let result = { turns: [], error: null };
  try {
    result = await loadTurns(storyId);
  } catch (e) {
    result = { turns: [], error: e?.message || String(e) };
  }
  res.status(200).setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify({ dbReady: dbReady(), turns: result.turns, error: result.error }));
}
