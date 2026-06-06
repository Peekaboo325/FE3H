// /api/turns
//   GET ?story_id=123  → 그 이야기의 본문(턴) 목록 (+ dbReady/error)
//   POST {id, content} → 한 턴 내용 수정
//   DELETE ?id=123     → 한 턴 삭제

import { loadTurns, updateTurn, deleteTurn, dbReady } from '../lib/db.mjs';

export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  try {
    if (req.method === 'GET') {
      const storyId = req.query?.story_id ? Number(req.query.story_id) : null;
      const { turns, error } = await loadTurns(storyId);
      res.status(200).end(JSON.stringify({ dbReady: dbReady(), turns, error }));
      return;
    }
    if (req.method === 'POST') {
      const { id, content } = req.body || {};
      if (!id) {
        res.status(400).end(JSON.stringify({ error: 'id가 필요합니다.' }));
        return;
      }
      const r = await updateTurn(Number(id), String(content ?? ''));
      res.status(r.error ? 500 : 200).end(JSON.stringify(r));
      return;
    }
    if (req.method === 'DELETE') {
      const id = req.query?.id ?? req.body?.id;
      const r = await deleteTurn(Number(id));
      res.status(r.error ? 500 : 200).end(JSON.stringify(r));
      return;
    }
    res.status(405).end(JSON.stringify({ error: '지원하지 않는 방식입니다.' }));
  } catch (e) {
    res.status(500).end(JSON.stringify({ error: e?.message || String(e) }));
  }
}
