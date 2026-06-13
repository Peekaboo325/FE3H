// /api/letters — 서신 교환소 (Gemini Flash). 설계 = docs/서신_설계.md.
//   GET    ?story_id=1&character_id=2     → 그 인물이 걸린 서신 전부
//   POST   {character_id, story_id}       → 새 서신 1통 생성(답장 우선·유서·신규)
//   PUT    {id, title?, content?, signature?, unseal?} → 편집 또는 개봉(읽음)
//   DELETE ?id=3                          → 서신 한 통 소각

import { runLetters, runDirectedLetter } from '../lib/letters.mjs';
import { listLetters, updateLetter, deleteLetter, dbReady } from '../lib/db.mjs';

export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  try {
    if (req.method === 'GET') {
      const storyId = req.query?.story_id ? Number(req.query.story_id) : null;
      const characterId = req.query?.character_id ? Number(req.query.character_id) : null;
      const r = await listLetters(storyId, characterId);
      res.status(200).end(JSON.stringify({ dbReady: dbReady(), ...r }));
      return;
    }
    if (req.method === 'POST') {
      if (!process.env.GEMINI_API_KEY) {
        res.status(400).end(
          JSON.stringify({ error: '전령과의 통로가 아직 닫혀 있습니다(GEMINI_API_KEY 없음).' }),
        );
        return;
      }
      const characterId = req.body?.character_id ? Number(req.body.character_id) : null;
      const storyId = req.body?.story_id ? Number(req.body.story_id) : null;
      const receiverId = req.body?.receiver_id ? Number(req.body.receiver_id) : null;
      // receiver_id 있으면 '수신 지정'(유저 지정발신 — 설계서 §13), 없으면 천운 교환소.
      const r = receiverId
        ? await runDirectedLetter({ characterId, storyId, receiverId })
        : await runLetters({ characterId, storyId });
      res.status(r.error ? 500 : 200).end(JSON.stringify({ dbReady: dbReady(), ...r }));
      return;
    }
    if (req.method === 'PUT') {
      const id = req.body?.id ? Number(req.body.id) : null;
      if (!id) {
        res.status(400).end(JSON.stringify({ error: '서신 지목이 없습니다.' }));
        return;
      }
      const fields = {};
      for (const k of ['title', 'content', 'signature']) if (req.body?.[k] !== undefined) fields[k] = req.body[k];
      if (req.body?.unseal) fields.is_sealed = false;
      const r = await updateLetter(id, fields);
      res.status(r.error ? 500 : 200).end(JSON.stringify({ dbReady: dbReady(), ...r }));
      return;
    }
    if (req.method === 'DELETE') {
      const id = req.query?.id ? Number(req.query.id) : null;
      if (!id) {
        res.status(400).end(JSON.stringify({ error: '서신 지목이 없습니다.' }));
        return;
      }
      const r = await deleteLetter(id);
      res.status(r.error ? 500 : 200).end(JSON.stringify({ dbReady: dbReady(), ...r }));
      return;
    }
    res.status(405).end(JSON.stringify({ error: '지원하지 않는 방식입니다.' }));
  } catch (e) {
    res.status(500).end(JSON.stringify({ error: e?.message || String(e) }));
  }
}
