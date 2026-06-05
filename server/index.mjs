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
  listStories,
  createStory,
  renameStory,
  deleteStory,
  touchStory,
  listCharacters,
  saveCharacter,
  deleteCharacter,
  loadCharactersForInjection,
  listLore,
  saveLore,
  deleteLore,
  loadLoreForInjection,
} from '../lib/db.mjs';
import { buildCharacterContext } from '../lib/charContext.mjs';
import { buildLoreContext } from '../lib/loreContext.mjs';

const PORT = process.env.PORT || 8787;
const MODEL = 'claude-opus-4-8';

console.log(`[서고] 세계관 박제 ${SYSTEM.length.toLocaleString()}자 적재 완료.`);

const app = express();
app.use(express.json({ limit: '1mb' }));

// 특정 이야기의 본문을 불러온다 (화면 복원용).
app.get('/api/turns', async (req, res) => {
  const storyId = req.query?.story_id ? Number(req.query.story_id) : null;
  let result = { turns: [], error: null };
  try {
    result = await loadTurns(storyId);
  } catch (e) {
    result = { turns: [], error: e?.message || String(e) };
  }
  res.json({ dbReady: dbReady(), turns: result.turns, error: result.error });
});

// ── 이야기(세이브 슬롯) 관리 ──────────────────────────────────────────────
app.get('/api/stories', async (_req, res) => {
  const { stories, error } = await listStories();
  res.json({ dbReady: dbReady(), stories, error });
});

app.post('/api/stories', async (req, res) => {
  const { id, title } = req.body || {};
  const r = id
    ? await renameStory(Number(id), (title || '').trim() || '제목 없는 이야기')
    : await createStory((title || '').trim());
  res.status(r.error ? 500 : 200).json(r);
});

app.delete('/api/stories', async (req, res) => {
  const id = req.query?.id ?? req.body?.id;
  const r = await deleteStory(Number(id));
  res.status(r.error ? 500 : 200).json(r);
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

// ── 견문록 (목록/저장/삭제) ────────────────────────────────────────────────
app.get('/api/lore', async (_req, res) => {
  const { lore, error } = await listLore();
  res.json({ dbReady: dbReady(), lore, error });
});

app.post('/api/lore', async (req, res) => {
  const entry = req.body?.entry;
  if (!entry?.title?.trim()) {
    res.status(400).json({ error: '제목은 필수입니다.' });
    return;
  }
  const r = await saveLore(entry);
  res.status(r.error ? 500 : 200).json(r);
});

app.delete('/api/lore', async (req, res) => {
  const id = req.query?.id ?? req.body?.id;
  const r = await deleteLore(Number(id));
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

  const storyId = req.body?.story_id ? Number(req.body.story_id) : null;
  const 새입력 = messages[messages.length - 1];
  if (새입력?.role === 'user') await saveTurn('user', 새입력.content, storyId);

  // 활성 견문록(세계 설정) + 활성 인물을 박제 세계관 뒤에 붙인다(캐싱 유지).
  const [설정원천, 인물원천] = await Promise.all([
    loadLoreForInjection(),
    loadCharactersForInjection(),
  ]);
  const 설정블록 = buildLoreContext(설정원천);
  const 인물블록 = buildCharacterContext(인물원천);
  const system = [{ type: 'text', text: SYSTEM, cache_control: { type: 'ephemeral' } }];
  if (설정블록) system.push({ type: 'text', text: 설정블록 });
  if (인물블록) system.push({ type: 'text', text: 인물블록 });

  const client = new Anthropic({ apiKey: key });
  res.status(200).type('text/plain; charset=utf-8');

  let 본문 = '';
  try {
    const stream = client.messages.stream({
      model: MODEL,
      max_tokens: 8000,
      thinking: { type: 'adaptive' },
      output_config: { effort: 'low' },
      system,
      messages,
    });

    stream.on('text', (delta) => {
      본문 += delta;
      res.write(delta);
    });
    await stream.finalMessage();

    if (본문.trim()) {
      await saveTurn('assistant', 본문, storyId);
      await touchStory(storyId);
    }
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
