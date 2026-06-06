// ─────────────────────────────────────────────────────────────────────────
//  서고의 영구 보관소 — Supabase 연결.
//
//  여기서만 Supabase 열쇠를 쥔다(서버 쪽에서만). 브라우저는 이 파일을 모른다.
//  열쇠가 아직 없으면(설정 전이면) 조용히 '저장 없음' 모드로 동작한다 —
//  그래서 Supabase 셋업 전에도 앱은 멀쩡히 돈다(이야기가 휘발될 뿐).
//
//  필요한 환경 변수 (Vercel 또는 .env):
//    SUPABASE_URL                — 프로젝트 주소
//    SUPABASE_SERVICE_ROLE_KEY   — 서버 전용 열쇠(비밀! 브라우저 금지)
// ─────────────────────────────────────────────────────────────────────────

import { createClient } from '@supabase/supabase-js';

let _client;
let _checked = false;

// 열쇠를 처음 쓸 때 한 번만 확인한다(.env 로딩 순서 문제 회피).
function getClient() {
  if (_checked) return _client;
  _checked = true;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  _client = url && key ? createClient(url, key, { auth: { persistSession: false } }) : null;
  if (!_client) console.log('[보관소] Supabase 미설정 — 저장 없이 동작합니다.');
  return _client;
}

export function dbReady() {
  return !!getClient();
}

// 특정 이야기(storyId)의 턴을 순서대로 불러온다. storyId 없으면 빈 목록.
export async function loadTurns(storyId) {
  const c = getClient();
  if (!c) return { turns: [], error: null };
  let q = c.from('turns').select('id, role, content').order('id', { ascending: true });
  if (storyId) q = q.eq('story_id', storyId);
  const { data, error } = await q;
  if (error) {
    console.error('[보관소] 불러오기 실패:', error.message);
    return { turns: [], error: error.message };
  }
  return { turns: data ?? [], error: null };
}

// 한 턴(유저 입력 또는 서술자 본문)을 해당 이야기에 영구 저장한다.
export async function saveTurn(role, content, storyId) {
  const c = getClient();
  if (!c) return;
  const row = { role, content };
  if (storyId) row.story_id = storyId;
  const { error } = await c.from('turns').insert(row);
  if (error) console.error('[보관소] 저장 실패:', error.message);
}

// 한 턴의 내용을 수정한다.
export async function updateTurn(id, content) {
  const c = getClient();
  if (!c) return { error: 'Supabase 미설정' };
  const { error } = await c.from('turns').update({ content }).eq('id', id);
  if (error) console.error('[보관소] 턴 수정 실패:', error.message);
  return { error: error?.message ?? null };
}

// 한 턴을 삭제한다.
export async function deleteTurn(id) {
  const c = getClient();
  if (!c) return { error: 'Supabase 미설정' };
  const { error } = await c.from('turns').delete().eq('id', id);
  if (error) console.error('[보관소] 턴 삭제 실패:', error.message);
  return { error: error?.message ?? null };
}

// ── 이야기(stories) — 세이브 슬롯 ──────────────────────────────────────────
export async function listStories() {
  const c = getClient();
  if (!c) return { stories: [], error: null };
  const { data, error } = await c
    .from('stories')
    .select('id,title,created_at,updated_at')
    .order('updated_at', { ascending: false });
  if (error) {
    console.error('[보관소] 이야기 목록 실패:', error.message);
    return { stories: [], error: error.message };
  }
  return { stories: data ?? [], error: null };
}

export async function createStory(title) {
  const c = getClient();
  if (!c) return { error: 'Supabase 미설정' };
  const { data, error } = await c
    .from('stories')
    .insert({ title: title || '제목 없는 이야기' })
    .select()
    .single();
  if (error) return { error: error.message };
  return { story: data };
}

export async function renameStory(id, title) {
  const c = getClient();
  if (!c) return { error: 'Supabase 미설정' };
  const { data, error } = await c
    .from('stories')
    .update({ title, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();
  if (error) return { error: error.message };
  return { story: data };
}

export async function deleteStory(id) {
  const c = getClient();
  if (!c) return { error: 'Supabase 미설정' };
  const { error } = await c.from('stories').delete().eq('id', id);
  if (error) console.error('[보관소] 이야기 삭제 실패:', error.message);
  return { error: error?.message ?? null };
}

// 마지막 플레이 시각 갱신(최근순 정렬용).
export async function touchStory(id) {
  const c = getClient();
  if (!c || !id) return;
  await c.from('stories').update({ updated_at: new Date().toISOString() }).eq('id', id);
}

// ── 인물(characters) ──────────────────────────────────────────────────────
// 편집 가능한 '커스텀 층' — 인물 프로필을 영구 저장/관리한다.

const 인물칸 = [
  'name',
  'english_name',
  'aliases',
  'faction',
  'title',
  'appearance',
  'personality',
  'combat',
  'notes',
  'life_status',
  'is_active',
  'thumbnail',
  'sort_order',
  'story_id',
];

// 들어온 객체에서 표에 있는 칸만 골라낸다(불필요/위험한 필드 차단).
function 인물정제(ch) {
  const row = {};
  for (const k of 인물칸) if (ch[k] !== undefined) row[k] = ch[k];
  return row;
}

export async function listCharacters(storyId) {
  const c = getClient();
  if (!c) return { characters: [], error: null };
  let q = c
    .from('characters')
    .select('*')
    .order('sort_order', { ascending: true })
    .order('id', { ascending: true });
  if (storyId) q = q.eq('story_id', storyId);
  const { data, error } = await q;
  if (error) {
    console.error('[보관소] 인물 불러오기 실패:', error.message);
    return { characters: [], error: error.message };
  }
  return { characters: data ?? [], error: null };
}

export async function saveCharacter(ch) {
  const c = getClient();
  if (!c) return { error: 'Supabase 미설정' };
  const row = 인물정제(ch);
  let res;
  if (ch.id) {
    res = await c.from('characters').update(row).eq('id', ch.id).select().single();
  } else {
    res = await c.from('characters').insert(row).select().single();
  }
  if (res.error) {
    console.error('[보관소] 인물 저장 실패:', res.error.message);
    return { error: res.error.message };
  }
  return { character: res.data };
}

export async function deleteCharacter(id) {
  const c = getClient();
  if (!c) return { error: 'Supabase 미설정' };
  const { error } = await c.from('characters').delete().eq('id', id);
  if (error) console.error('[보관소] 인물 삭제 실패:', error.message);
  return { error: error?.message ?? null };
}

// 서사 주입용 — 인물의 '텍스트 설정만' 불러온다(썸네일 제외, 활성 필터는 호출부에서).
export async function loadCharactersForInjection(storyId) {
  const c = getClient();
  if (!c) return [];
  let q = c
    .from('characters')
    .select('name,english_name,aliases,faction,title,appearance,personality,combat,notes,life_status,is_active')
    .order('sort_order', { ascending: true })
    .order('id', { ascending: true });
  if (storyId) q = q.eq('story_id', storyId);
  const { data, error } = await q;
  if (error) {
    console.error('[보관소] 주입용 인물 불러오기 실패:', error.message);
    return [];
  }
  return data ?? [];
}

// ── 견문록(lore) — 연재 고유 세계 설정 (편집 가능한 커스텀 층) ───────────────
const 견문록칸 = ['title', 'category', 'body', 'is_active', 'sort_order', 'story_id'];

function 견문록정제(e) {
  const row = {};
  for (const k of 견문록칸) if (e[k] !== undefined) row[k] = e[k];
  return row;
}

export async function listLore(storyId) {
  const c = getClient();
  if (!c) return { lore: [], error: null };
  let q = c
    .from('lore')
    .select('*')
    .order('sort_order', { ascending: true })
    .order('id', { ascending: true });
  if (storyId) q = q.eq('story_id', storyId);
  const { data, error } = await q;
  if (error) {
    console.error('[보관소] 견문록 불러오기 실패:', error.message);
    return { lore: [], error: error.message };
  }
  return { lore: data ?? [], error: null };
}

export async function saveLore(e) {
  const c = getClient();
  if (!c) return { error: 'Supabase 미설정' };
  const row = 견문록정제(e);
  let res;
  if (e.id) res = await c.from('lore').update(row).eq('id', e.id).select().single();
  else res = await c.from('lore').insert(row).select().single();
  if (res.error) {
    console.error('[보관소] 견문록 저장 실패:', res.error.message);
    return { error: res.error.message };
  }
  return { entry: res.data };
}

export async function deleteLore(id) {
  const c = getClient();
  if (!c) return { error: 'Supabase 미설정' };
  const { error } = await c.from('lore').delete().eq('id', id);
  if (error) console.error('[보관소] 견문록 삭제 실패:', error.message);
  return { error: error?.message ?? null };
}

export async function loadLoreForInjection(storyId) {
  const c = getClient();
  if (!c) return [];
  let q = c
    .from('lore')
    .select('title,category,body,is_active')
    .order('sort_order', { ascending: true })
    .order('id', { ascending: true });
  if (storyId) q = q.eq('story_id', storyId);
  const { data, error } = await q;
  if (error) {
    console.error('[보관소] 주입용 견문록 불러오기 실패:', error.message);
    return [];
  }
  return data ?? [];
}
