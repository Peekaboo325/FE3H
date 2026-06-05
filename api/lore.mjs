// /api/lore — 견문록(연재 고유 설정) 보관소.
//   GET                → 전체 목록
//   POST  {entry}      → 추가(id 없으면) / 수정(id 있으면)
//   DELETE ?id=123     → 삭제

import { listLore, saveLore, deleteLore, dbReady } from '../lib/db.mjs';

export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  try {
    if (req.method === 'GET') {
      const storyId = req.query?.story_id ? Number(req.query.story_id) : null;
      const { lore, error } = await listLore(storyId);
      res.status(200).end(JSON.stringify({ dbReady: dbReady(), lore, error }));
      return;
    }
    if (req.method === 'POST') {
      const entry = req.body?.entry;
      if (!entry?.title?.trim()) {
        res.status(400).end(JSON.stringify({ error: '제목은 필수입니다.' }));
        return;
      }
      const r = await saveLore(entry);
      res.status(r.error ? 500 : 200).end(JSON.stringify(r));
      return;
    }
    if (req.method === 'DELETE') {
      const id = req.query?.id ?? req.body?.id;
      const r = await deleteLore(Number(id));
      res.status(r.error ? 500 : 200).end(JSON.stringify(r));
      return;
    }
    res.status(405).end(JSON.stringify({ error: '지원하지 않는 방식입니다.' }));
  } catch (e) {
    res.status(500).end(JSON.stringify({ error: e?.message || String(e) }));
  }
}
