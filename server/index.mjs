// ─────────────────────────────────────────────────────────────────────────
//  서고(書庫) — 로컬 개발용 서버. (Vercel 배포 시엔 api/*.mjs 가 이 역할)
//
//  하는 일은 api/story.mjs + api/turns.mjs 와 동일하다:
//   열쇠를 쥐고 → 박제 세계관을 주입해 → 클로드 본문을 스트리밍하고,
//   이야기를 Supabase에 영구 저장/복원한다.
//  세계관은 lib/worldview.mjs, 저장소는 lib/db.mjs — Vercel 함수와 같은 출처.
// ─────────────────────────────────────────────────────────────────────────

import 'dotenv/config';
import express from 'express';
import Anthropic from '@anthropic-ai/sdk';
import { SYSTEM } from '../lib/worldview.mjs';
import {
  loadTurns,
  saveTurn,
  dbReady,
  listCharacters,
  saveCharacter,
  deleteCharacter,
} from '../lib/db.mjs';

const PORT = process.env.PORT || 8787;
const MODEL = 'claude-opus-4-8';

console.log(`[서고] 세계관 박제 ${SYSTEM.length.toLocaleString()}자 적재 완료.`);

const app = express();
app.use(express.json({ limit: '1mb' }));

// 지금까지의 이야기를 불러온다 (화면 복원용).
app.get('/api/turns', async (_req, res) => {
  let result = { turns: [], error: null };
  try {
    result = await loadTurns();
  } catch (e) {
    result = { turns: [], error: e?.message || String(e) };
  }
  res.json({ dbReady: dbReady(), turns: result.turns, error: result.error });
});

// ── 인물 프로필 (목록/저장/삭제) ──────────────────────────────────────────
app.get('/api/characters', async (_req, res) => {
  const { characters, error } = await listCharacters();
  res.json({ dbReady: dbReady(), characters, error });
});

app.post('/api/characters', async (req, res) => {
  const ch = req.body?.character;
  if (!ch?.name?.trim()) {
    res.status(400).json({ error: '이름은 필수입니다.' });
    return;
  }
  const r = await saveCharacter(ch);
  res.status(r.error ? 500 : 200).json(r);
});

app.delete('/api/characters', async (req, res) => {
  const id = req.query?.id ?? req.body?.id;
  const r = await deleteCharacter(Number(id));
  res.status(r.error ? 500 : 200).json(r);
});

app.post('/api/story', async (req, res) => {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) {
    res.status(400).type('text/plain; charset=utf-8');
    res.end(
      '[서고] 아직 클로드 API 열쇠가 꽂히지 않았습니다.\n' +
        '.env 파일에 ANTHROPIC_API_KEY 값을 넣고 서버를 다시 켜 주세요.',
    );
    return;
  }

  const messages = Array.isArray(req.body?.messages) ? req.body.messages : [];
  if (messages.length === 0) {
    res.status(400).type('text/plain; charset=utf-8').end('[서고] 입력이 비어 있습니다.');
    return;
  }

  const 새입력 = messages[messages.length - 1];
  if (새입력?.role === 'user') await saveTurn('user', 새입력.content);

  const client = new Anthropic({ apiKey: key });
  res.status(200).type('text/plain; charset=utf-8');

  let 본문 = '';
  try {
    const stream = client.messages.stream({
      model: MODEL,
      max_tokens: 8000,
      thinking: { type: 'adaptive' },
      output_config: { effort: 'low' },
      system: [{ type: 'text', text: SYSTEM, cache_control: { type: 'ephemeral' } }],
      messages,
    });

    stream.on('text', (delta) => {
      본문 += delta;
      res.write(delta);
    });
    await stream.finalMessage();

    if (본문.trim()) await saveTurn('assistant', 본문);
    res.end();
  } catch (err) {
    const 사유 = err?.message || String(err);
    console.error('[서고] 클로드 호출 오류:', 사유);
    if (!res.headersSent) res.status(500).type('text/plain; charset=utf-8');
    res.write(`\n\n[서고 오류] 본문 생성에 실패했습니다: ${사유}`);
    res.end();
  }
});

app.listen(PORT, () => {
  console.log(`[서고] 포트 ${PORT}에서 깨어남. 클로드와의 통로 열림.`);
  if (!process.env.ANTHROPIC_API_KEY) {
    console.log('[서고] (아직 ANTHROPIC_API_KEY 없음 — .env에 열쇠를 꽂으면 켜집니다.)');
  }
});
