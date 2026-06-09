// /api/guidance — 기록 지침(전역 유저 커스텀 프롬프트) 읽기/기록.
//  GET  → { dbReady, text }            : 현재 지침
//  POST { text } → { ok, error }        : 지침 기록(전역 단일 값)
//  settings 표가 없으면 dbReady는 true여도 저장은 실패(error) → UI가 안내.

import { getGuidance, setGuidance, dbReady } from '../lib/db.mjs';

export default async function handler(req, res) {
  try {
    if (req.method === 'POST') {
      const text = typeof req.body?.text === 'string' ? req.body.text : '';
      const r = await setGuidance(text);
      res.status(r.ok ? 200 : 500).json({ ok: r.ok, error: r.error });
      return;
    }
    const text = await getGuidance();
    res.status(200).json({ dbReady: dbReady(), text });
  } catch (e) {
    res.status(200).json({ dbReady: dbReady(), text: '', error: e?.message || String(e) });
  }
}
