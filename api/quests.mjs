// /api/quests — 임무 장부 발급 (Gemini Flash).
//   POST {character_id, story_id} → analysis.quests 갱신, 갱신된 analysis 전체 반환

import { runQuests } from '../lib/quests.mjs';
import { dbReady } from '../lib/db.mjs';

export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  try {
    if (req.method !== 'POST') {
      res.status(405).end(JSON.stringify({ error: '지원하지 않는 방식입니다.' }));
      return;
    }
    if (!process.env.GEMINI_API_KEY) {
      res.status(400).end(
        JSON.stringify({ error: '분석관과의 통로가 아직 닫혀 있습니다(GEMINI_API_KEY 없음).' }),
      );
      return;
    }
    const characterId = req.body?.character_id ? Number(req.body.character_id) : null;
    const storyId = req.body?.story_id ? Number(req.body.story_id) : null;
    const r = await runQuests({ characterId, storyId });
    res.status(r.error ? 500 : 200).end(JSON.stringify({ dbReady: dbReady(), ...r }));
  } catch (e) {
    res.status(500).end(JSON.stringify({ error: e?.message || String(e) }));
  }
}
