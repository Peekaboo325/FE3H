// /api/journal — 인물 일지(日誌) 술회·소각 (Gemini Flash).
//   POST   {character_id, story_id} → 일지 한 장 술회·누적, 갱신된 analysis 전체 반환
//   DELETE ?character_id&id         → 일지 한 장 소각

import { runJournal, removeJournal } from '../lib/journal.mjs';
import { dbReady } from '../lib/db.mjs';

export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  try {
    if (req.method === 'POST') {
      if (!process.env.GEMINI_API_KEY) {
        res.status(400).end(
          JSON.stringify({ error: '분석관과의 통로가 아직 닫혀 있습니다(GEMINI_API_KEY 없음).' }),
        );
        return;
      }
      const characterId = req.body?.character_id ? Number(req.body.character_id) : null;
      const storyId = req.body?.story_id ? Number(req.body.story_id) : null;
      const r = await runJournal({ characterId, storyId });
      res.status(r.error ? 500 : 200).end(JSON.stringify({ dbReady: dbReady(), ...r }));
      return;
    }
    if (req.method === 'DELETE') {
      const characterId = req.query?.character_id ? Number(req.query.character_id) : null;
      const entryId = req.query?.id || null;
      const r = await removeJournal({ characterId, entryId });
      res.status(r.error ? 500 : 200).end(JSON.stringify({ dbReady: dbReady(), ...r }));
      return;
    }
    res.status(405).end(JSON.stringify({ error: '지원하지 않는 방식입니다.' }));
  } catch (e) {
    res.status(500).end(JSON.stringify({ error: e?.message || String(e) }));
  }
}
