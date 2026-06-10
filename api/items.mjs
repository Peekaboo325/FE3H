// /api/items — 소지품 탐색·소각·정렬 (Gemini Flash).
//   POST {character_id, story_id}      → 물건 3점을 새로 찾아 누적, 갱신된 analysis 전체 반환
//   DELETE ?character_id=1&id=iabc     → 물건 하나 소각
//   PUT {character_id, order:[id…]}    → 드래그 정렬 저장

import { runItems, removeItem, reorderItems } from '../lib/items.mjs';
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
      const r = await runItems({ characterId, storyId });
      res.status(r.error ? 500 : 200).end(JSON.stringify({ dbReady: dbReady(), ...r }));
      return;
    }
    if (req.method === 'PUT') {
      const characterId = req.body?.character_id ? Number(req.body.character_id) : null;
      const order = Array.isArray(req.body?.order) ? req.body.order : null;
      const r = await reorderItems({ characterId, order });
      res.status(r.error ? 500 : 200).end(JSON.stringify({ dbReady: dbReady(), ...r }));
      return;
    }
    if (req.method === 'DELETE') {
      const characterId = req.query?.character_id ? Number(req.query.character_id) : null;
      const itemId = req.query?.id || null;
      const r = await removeItem({ characterId, itemId });
      res.status(r.error ? 500 : 200).end(JSON.stringify({ dbReady: dbReady(), ...r }));
      return;
    }
    res.status(405).end(JSON.stringify({ error: '지원하지 않는 방식입니다.' }));
  } catch (e) {
    res.status(500).end(JSON.stringify({ error: e?.message || String(e) }));
  }
}
