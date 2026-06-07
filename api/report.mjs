// /api/report — 인물 분석 보고서 발급 (Gemini Flash).
//   POST {character_id, story_id?, instruction?}  → 보고서 발급·저장 후 {report} 반환

import { runReport } from '../lib/report.mjs';
import { dbReady } from '../lib/db.mjs';

export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  if (req.method !== 'POST') {
    res.status(405).end(JSON.stringify({ error: '지원하지 않는 방식입니다.' }));
    return;
  }
  if (!process.env.GEMINI_API_KEY) {
    res.status(400).end(JSON.stringify({ error: '분석관과의 통로가 아직 닫혀 있습니다(GEMINI_API_KEY 없음).' }));
    return;
  }
  try {
    const characterId = req.body?.character_id ? Number(req.body.character_id) : null;
    const storyId = req.body?.story_id ? Number(req.body.story_id) : null;
    const instruction = (req.body?.instruction || '').trim();
    const r = await runReport({ characterId, storyId, customInstruction: instruction });
    res.status(r.error ? 500 : 200).end(JSON.stringify({ dbReady: dbReady(), ...r }));
  } catch (e) {
    res.status(500).end(JSON.stringify({ error: e?.message || String(e) }));
  }
}
