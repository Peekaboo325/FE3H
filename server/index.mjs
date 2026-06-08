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
  updateTurn,
  deleteTurn,
  dbReady,
  listStories,
  createStory,
  renameStory,
  deleteStory,
  copyStory,
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
import { runReport } from '../lib/report.mjs';
import { buildLoreContext } from '../lib/loreContext.mjs';
import { prepareConversation, buildSummaryBlock } from '../lib/memory.mjs';
import { loadTurnsForSummary } from '../lib/db.mjs';
import { ensureEpisodeSummaries, buildChronicle } from '../lib/chronicle.mjs';
import {
  parseAnchors,
  buildAnchorContext,
  parseLoreAnchors,
  buildLoreAnchorContext,
} from '../lib/anchor.mjs';

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

// 한 턴 수정 / 삭제
app.post('/api/turns', async (req, res) => {
  const { id, content } = req.body || {};
  if (!id) {
    res.status(400).json({ error: 'id가 필요합니다.' });
    return;
  }
  const r = await updateTurn(Number(id), String(content ?? ''));
  res.status(r.error ? 500 : 200).json(r);
});

app.delete('/api/turns', async (req, res) => {
  const id = req.query?.id ?? req.body?.id;
  const r = await deleteTurn(Number(id));
  res.status(r.error ? 500 : 200).json(r);
});

// ── 이야기(세이브 슬롯) 관리 ──────────────────────────────────────────────
app.get('/api/stories', async (_req, res) => {
  const { stories, error } = await listStories();
  res.json({ dbReady: dbReady(), stories, error });
});

app.post('/api/stories', async (req, res) => {
  const { id, title, copy_from } = req.body || {};
  let r;
  if (copy_from) r = await copyStory(Number(copy_from));
  else if (id) r = await renameStory(Number(id), (title || '').trim() || '제목 없는 이야기');
  else r = await createStory((title || '').trim());
  res.status(r.error ? 500 : 200).json(r);
});

app.delete('/api/stories', async (req, res) => {
  const id = req.query?.id ?? req.body?.id;
  const r = await deleteStory(Number(id));
  res.status(r.error ? 500 : 200).json(r);
});

// ── 연대 문헌 (화별 요약 조회 + 빠진 요약 lazy 생성) ───────────────────────
app.get('/api/chronicle', async (req, res) => {
  const storyId = req.query?.story_id ? Number(req.query.story_id) : null;
  try {
    const { turns, hasSummaryCol } = await loadTurnsForSummary(storyId);
    if (hasSummaryCol && storyId) await ensureEpisodeSummaries(turns);
    res.json({ dbReady: dbReady(), ready: hasSummaryCol, chronicle: buildChronicle(turns) });
  } catch (e) {
    res.json({ dbReady: dbReady(), ready: false, chronicle: [], error: e?.message || String(e) });
  }
});

// ── 인물 프로필 (목록/저장/삭제) ──────────────────────────────────────────
app.get('/api/characters', async (req, res) => {
  const storyId = req.query?.story_id ? Number(req.query.story_id) : null;
  const { characters, error } = await listCharacters(storyId);
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

// ── 인물 분석 보고서 발급 (Gemini Flash) ──────────────────────────────────
app.post('/api/report', async (req, res) => {
  if (!process.env.GEMINI_API_KEY) {
    res.status(400).json({ error: '분석관과의 통로가 아직 닫혀 있습니다(GEMINI_API_KEY 없음).' });
    return;
  }
  const characterId = req.body?.character_id ? Number(req.body.character_id) : null;
  const storyId = req.body?.story_id ? Number(req.body.story_id) : null;
  const instruction = (req.body?.instruction || '').trim();
  try {
    const r = await runReport({ characterId, storyId, customInstruction: instruction });
    res.status(r.error ? 500 : 200).json({ dbReady: dbReady(), ...r });
  } catch (e) {
    res.status(500).json({ error: e?.message || String(e) });
  }
});

// ── 견문록 (목록/저장/삭제) ────────────────────────────────────────────────
app.get('/api/lore', async (req, res) => {
  const storyId = req.query?.story_id ? Number(req.query.story_id) : null;
  const { lore, error } = await listLore(storyId);
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

  // 컨텍스트 윈도우: 전체 대화 대신 '줄거리 요약 + 최근 N턴 원문'으로 재구성.
  // + 앵커링: "N화 참고"(회차) / "제N권·(제목) 참조"(문헌)를 지목했으면 골라 주입.
  const 입력문 = 새입력?.role === 'user' ? 새입력.content : '';
  const 지목 = parseAnchors(입력문);
  const 견문록지목 = parseLoreAnchors(입력문);
  const [{ messages: 대화, summary: 줄거리 }, 참고, 견문록참고] = await Promise.all([
    prepareConversation(storyId, messages),
    지목.length ? buildAnchorContext(storyId, 입력문, 지목) : Promise.resolve({ block: null, episodes: [] }),
    견문록지목.refs.length || 견문록지목.titles.length
      ? buildLoreAnchorContext(storyId, 견문록지목)
      : Promise.resolve({ block: null, items: [] }),
  ]);

  // 활성 견문록(세계 설정) + 활성 인물을 박제 세계관 뒤에 붙인다(캐싱 유지).
  const [설정원천, 인물원천] = await Promise.all([
    loadLoreForInjection(storyId),
    loadCharactersForInjection(storyId),
  ]);
  const 설정블록 = buildLoreContext(설정원천);
  const 인물블록 = buildCharacterContext(인물원천);
  const 줄거리블록 = buildSummaryBlock(줄거리);
  const system = [{ type: 'text', text: SYSTEM, cache_control: { type: 'ephemeral' } }];
  if (설정블록) system.push({ type: 'text', text: 설정블록 });
  if (인물블록) system.push({ type: 'text', text: 인물블록 });
  if (줄거리블록) system.push({ type: 'text', text: 줄거리블록 }); // 대화 앞 = 최신 맥락
  if (견문록참고.block) system.push({ type: 'text', text: 견문록참고.block }); // 지목 문헌
  if (참고.block) system.push({ type: 'text', text: 참고.block }); // 지목 회차 = 가장 가까이

  const client = new Anthropic({ apiKey: key });
  res.status(200).type('text/plain; charset=utf-8');

  // 실제로 되짚은 회차·문헌을 헤더로 — 클라가 그 화에 '확인 자취'를 남긴다(본문 전에 전송).
  const 자취 = {};
  if (참고.episodes.length) 자취.ep = 참고.episodes;
  if (견문록참고.items.length) 자취.lore = 견문록참고.items;
  if (자취.ep || 자취.lore) {
    res.setHeader('x-recall', encodeURIComponent(JSON.stringify(자취)));
  }

  let 본문 = '';
  try {
    const stream = client.messages.stream({
      model: MODEL,
      max_tokens: 8000,
      thinking: { type: 'adaptive' },
      output_config: { effort: 'low' },
      system,
      messages: 대화,
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

// 한 답변 다시 받기 — 새 유저턴 저장 없이 turn_id 칸만 갱신.
app.post('/api/regen', async (req, res) => {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) {
    res.status(400).type('text/plain; charset=utf-8').end('[서고] 클로드 API 열쇠가 없습니다.');
    return;
  }
  const messages = Array.isArray(req.body?.messages) ? req.body.messages : [];
  const storyId = req.body?.story_id ? Number(req.body.story_id) : null;
  const turnId = req.body?.turn_id ? Number(req.body.turn_id) : null;
  if (messages.length === 0 || !turnId) {
    res.status(400).type('text/plain; charset=utf-8').end('[서고] 잘못된 재생성 요청입니다.');
    return;
  }

  const [설정원천, 인물원천] = await Promise.all([
    loadLoreForInjection(storyId),
    loadCharactersForInjection(storyId),
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
    if (본문.trim()) await updateTurn(turnId, 본문, true); // 요약 무효화(재생성)
    res.end();
  } catch (err) {
    const 사유 = err?.message || String(err);
    console.error('[서고] 재생성 오류:', 사유);
    if (!res.headersSent) res.status(500).type('text/plain; charset=utf-8');
    res.write(`\n\n[서고 오류] 재생성에 실패했습니다: ${사유}`);
    res.end();
  }
});

app.listen(PORT, () => {
  console.log(`[서고] 포트 ${PORT}에서 깨어남. 클로드와의 통로 열림.`);
  if (!process.env.ANTHROPIC_API_KEY) {
    console.log('[서고] (아직 ANTHROPIC_API_KEY 없음 — .env에 열쇠를 꽂으면 켜집니다.)');
  }
});
