// /api/turns
//   GET ?story_id=123  → 그 이야기의 본문(턴) 목록 (+ dbReady/error)
//   POST {id, content} → 한 턴 내용 수정
//   DELETE ?id=123     → 한 턴 삭제
//   DELETE ?story_id=7 → 그 장의 본문 전체 비우기(환원 — 연대 문헌도 함께 사라짐)

import { loadTurns, updateTurn, deleteTurn, clearTurns, dbReady, setPolishedShow } from '../lib/db.mjs';

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
      const { id, content, polished_show } = req.body || {};
      if (!id) {
        res.status(400).end(JSON.stringify({ error: 'id가 필요합니다.' }));
        return;
      }
      // 보기 토글만 영속화(원본↔교정본) — content 없이 polished_show만 온 경우.
      if (content === undefined && polished_show !== undefined) {
        const r = await setPolishedShow(Number(id), polished_show);
        res.status(r.error ? 500 : 200).end(JSON.stringify(r));
        return;
      }
      const r = await updateTurn(Number(id), String(content ?? ''));
      res.status(r.error ? 500 : 200).end(JSON.stringify(r));
      return;
    }
    if (req.method === 'DELETE') {
      const storyId = req.query?.story_id ?? req.body?.story_id;
      if (storyId) {
        const r = await clearTurns(Number(storyId)); // 환원
        res.status(r.error ? 500 : 200).end(JSON.stringify(r));
        return;
      }
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
