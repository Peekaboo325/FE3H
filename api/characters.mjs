// /api/characters — 인물 프로필 보관소 (목록/저장/삭제).
//   GET                  → 전체 인물 목록
//   POST  {character}    → 추가(id 없으면) 또는 수정(id 있으면)
//   DELETE ?id=123       → 삭제

import { listCharacters, saveCharacter, deleteCharacter, dbReady } from '../lib/db.mjs';

export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  try {
    if (req.method === 'GET') {
      const storyId = req.query?.story_id ? Number(req.query.story_id) : null;
      const { characters, error } = await listCharacters(storyId);
      res.status(200).end(JSON.stringify({ dbReady: dbReady(), characters, error }));
      return;
    }
    if (req.method === 'POST') {
      const ch = req.body?.character;
      if (!ch?.name?.trim()) {
        res.status(400).end(JSON.stringify({ error: '이름은 필수입니다.' }));
        return;
      }
      const r = await saveCharacter(ch);
      res.status(r.error ? 500 : 200).end(JSON.stringify(r));
      return;
    }
    if (req.method === 'DELETE') {
      const id = req.query?.id ?? req.body?.id;
      const r = await deleteCharacter(Number(id));
      res.status(r.error ? 500 : 200).end(JSON.stringify(r));
      return;
    }
    res.status(405).end(JSON.stringify({ error: '지원하지 않는 방식입니다.' }));
  } catch (e) {
    res.status(500).end(JSON.stringify({ error: e?.message || String(e) }));
  }
}
