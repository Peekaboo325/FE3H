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

// 지금까지의 이야기(턴)를 순서대로 불러온다.
// 진단을 위해 { turns, error } 형태로 돌려준다(error는 막혔을 때 사유 문자열).
export async function loadTurns() {
  const c = getClient();
  if (!c) return { turns: [], error: null };
  const { data, error } = await c.from('turns').select('role, content').order('id', { ascending: true });
  if (error) {
    console.error('[보관소] 불러오기 실패:', error.message);
    return { turns: [], error: error.message };
  }
  return { turns: data ?? [], error: null };
}

// 한 턴(유저 입력 또는 서술자 본문)을 영구 저장한다.
export async function saveTurn(role, content) {
  const c = getClient();
  if (!c) return;
  const { error } = await c.from('turns').insert({ role, content });
  if (error) console.error('[보관소] 저장 실패:', error.message);
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
];

// 들어온 객체에서 표에 있는 칸만 골라낸다(불필요/위험한 필드 차단).
function 인물정제(ch) {
  const row = {};
  for (const k of 인물칸) if (ch[k] !== undefined) row[k] = ch[k];
  return row;
}

export async function listCharacters() {
  const c = getClient();
  if (!c) return { characters: [], error: null };
  const { data, error } = await c
    .from('characters')
    .select('*')
    .order('sort_order', { ascending: true })
    .order('id', { ascending: true });
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
export async function loadCharactersForInjection() {
  const c = getClient();
  if (!c) return [];
  const { data, error } = await c
    .from('characters')
    .select('name,english_name,aliases,faction,title,appearance,personality,combat,notes,life_status,is_active')
    .order('sort_order', { ascending: true })
    .order('id', { ascending: true });
  if (error) {
    console.error('[보관소] 주입용 인물 불러오기 실패:', error.message);
    return [];
  }
  return data ?? [];
}

// ── 견문록(lore) — 연재 고유 세계 설정 (편집 가능한 커스텀 층) ───────────────
const 견문록칸 = ['title', 'category', 'body', 'is_active', 'sort_order'];

function 견문록정제(e) {
  const row = {};
  for (const k of 견문록칸) if (e[k] !== undefined) row[k] = e[k];
  return row;
}

export async function listLore() {
  const c = getClient();
  if (!c) return { lore: [], error: null };
  const { data, error } = await c
    .from('lore')
    .select('*')
    .order('sort_order', { ascending: true })
    .order('id', { ascending: true });
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

export async function loadLoreForInjection() {
  const c = getClient();
  if (!c) return [];
  const { data, error } = await c
    .from('lore')
    .select('title,category,body,is_active')
    .order('sort_order', { ascending: true })
    .order('id', { ascending: true });
  if (error) {
    console.error('[보관소] 주입용 견문록 불러오기 실패:', error.message);
    return [];
  }
  return data ?? [];
}
