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
export async function loadTurns() {
  const c = getClient();
  if (!c) return [];
  const { data, error } = await c.from('turns').select('role, content').order('id', { ascending: true });
  if (error) {
    console.error('[보관소] 불러오기 실패:', error.message);
    return [];
  }
  return data ?? [];
}

// 한 턴(유저 입력 또는 서술자 본문)을 영구 저장한다.
export async function saveTurn(role, content) {
  const c = getClient();
  if (!c) return;
  const { error } = await c.from('turns').insert({ role, content });
  if (error) console.error('[보관소] 저장 실패:', error.message);
}
