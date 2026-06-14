// /api/supply — 물자 조달 (설계 = docs/물자조달_설계.md)
//   GET  ?story_id=                                 → { shops, stock }
//   POST {story_id, shop}                           → 새로 입하(Gemini) → { stock }
//   POST {story_id, shop, item_id, character_id}    → 조달(DB만) → { stock, report }

import { runRestock, procureItem, SHOPS } from '../lib/supply.mjs';
import { getSupply, dbReady } from '../lib/db.mjs';

export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  try {
    if (req.method === 'GET') {
      const storyId = req.query?.story_id ? Number(req.query.story_id) : null;
      const stock = await getSupply(storyId);
      res.status(200).end(
        JSON.stringify({ dbReady: dbReady(), shops: SHOPS.map((s) => ({ key: s.key, label: s.label })), stock }),
      );
      return;
    }
    if (req.method === 'POST') {
      const storyId = req.body?.story_id ? Number(req.body.story_id) : null;
      const shop = req.body?.shop || null;
      const itemId = req.body?.item_id || null;
      const characterId = req.body?.character_id ? Number(req.body.character_id) : null;
      // 조달(인물 지목 있음) — 콜 없이 DB만.
      if (itemId && characterId) {
        const r = await procureItem({ storyId, shop, itemId, characterId });
        res.status(r.error ? 500 : 200).end(JSON.stringify({ dbReady: dbReady(), ...r }));
        return;
      }
      // 새로 입하 — Gemini 필요.
      if (!process.env.GEMINI_API_KEY) {
        res.status(400).end(JSON.stringify({ error: '분석관과의 통로가 아직 닫혀 있습니다(GEMINI_API_KEY 없음).' }));
        return;
      }
      const r = await runRestock({ storyId, shop });
      res.status(r.error ? 500 : 200).end(JSON.stringify({ dbReady: dbReady(), ...r }));
      return;
    }
    res.status(405).end(JSON.stringify({ error: '지원하지 않는 방식입니다.' }));
  } catch (e) {
    res.status(500).end(JSON.stringify({ error: e?.message || String(e) }));
  }
}
