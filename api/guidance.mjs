// /api/guidance — 기록 지침(장별 유저 커스텀 프롬프트) 읽기/기록.
//  GET  ?story_id=1 → { dbReady, text }       : 그 장의 지침
//  POST { story_id, text } → { ok, error }    : 그 장의 지침 기록
//  ⚠️ 2026-06-13부터 장별 분리(빌더 확정) — 전역 단일 값이던 옛 동작은 폐기.
//  settings 표가 없으면 dbReady는 true여도 저장은 실패(error) → UI가 안내.

import { getGuidance, setGuidance, dbReady } from '../lib/db.mjs';

export default async function handler(req, res) {
  try {
    if (req.method === 'POST') {
      const storyId = req.body?.story_id ? Number(req.body.story_id) : null;
      const text = typeof req.body?.text === 'string' ? req.body.text : '';
      const r = await setGuidance(storyId, text);
      res.status(r.ok ? 200 : 500).json({ ok: r.ok, error: r.error });
      return;
    }
    const storyId = req.query?.story_id ? Number(req.query.story_id) : null;
    const text = await getGuidance(storyId);
    res.status(200).json({ dbReady: dbReady(), text });
  } catch (e) {
    res.status(200).json({ dbReady: dbReady(), text: '', error: e?.message || String(e) });
  }
}
