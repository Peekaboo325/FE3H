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

// 화별 요약(연대 문헌)을 포함해 턴을 불러온다.
// ⚠️ turns.summary 컬럼이 아직 없으면(SQL 미실행) 컬럼 없이 재시도 → 앱은 기존대로.
export async function loadTurnsForSummary(storyId) {
  const c = getClient();
  if (!c) return { turns: [], hasSummaryCol: false };
  const order = { ascending: true };
  let q = c.from('turns').select('id, role, content, summary').order('id', order);
  if (storyId) q = q.eq('story_id', storyId);
  const { data, error } = await q;
  if (!error) return { turns: data ?? [], hasSummaryCol: true };
  // summary 컬럼 없음 등 → 컬럼 없이 다시.
  let q2 = c.from('turns').select('id, role, content').order('id', order);
  if (storyId) q2 = q2.eq('story_id', storyId);
  const r2 = await q2;
  return { turns: r2.data ?? [], hasSummaryCol: false };
}

// 한 화(assistant 턴)의 요약을 저장한다.
export async function setTurnSummary(id, summary) {
  const c = getClient();
  if (!c || !id) return;
  const { error } = await c.from('turns').update({ summary }).eq('id', id);
  if (error) console.error('[보관소] 화 요약 저장 실패:', error.message);
}

// 한 턴의 본문+이야기id를 가져온다(연대 문헌 '재작성'=단일 화 재요약용 — storyId로 인물·큰줄기 맥락 로드).
export async function getTurnContent(id) {
  const c = getClient();
  if (!c || !id) return { content: null, storyId: null };
  const { data, error } = await c.from('turns').select('content, story_id').eq('id', id).maybeSingle();
  if (error) {
    console.error('[보관소] 턴 본문 조회 실패:', error.message);
    return { content: null, storyId: null };
  }
  return { content: data?.content ?? null, storyId: data?.story_id ?? null };
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
//  clearSummary=true면 화 요약도 비운다(다시 받기=내용 갈아엎기 → 요약 무효화, lazy 재생성).
//  수정(문체·단어 교정)은 clearSummary=false로 요약을 유지한다.
export async function updateTurn(id, content, clearSummary = false) {
  const c = getClient();
  if (!c) return { error: 'Supabase 미설정' };
  if (clearSummary) {
    let { error } = await c.from('turns').update({ content, summary: null }).eq('id', id);
    if (error) {
      // summary 컬럼이 없을 수 있음 → content만 갱신
      ({ error } = await c.from('turns').update({ content }).eq('id', id));
    }
    if (error) console.error('[보관소] 턴 수정 실패:', error.message);
    return { error: error?.message ?? null };
  }
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

// 한 장(이야기)의 본문(턴)을 전부 비운다 — 환원.
//  연대 문헌은 턴의 summary에 사는 기록이라 함께 사라진다. 장·인물·문헌은 남는다.
export async function clearTurns(storyId) {
  const c = getClient();
  if (!c) return { error: 'Supabase 미설정' };
  const { error } = await c.from('turns').delete().eq('story_id', storyId);
  if (error) console.error('[보관소] 장 환원 실패:', error.message);
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
  // 장별 기록 지침도 함께 정리(settings엔 cascade가 없으니 직접) — 실패해도 무해(고아 행).
  if (!error) await c.from('settings').delete().eq('key', `guidance:${id}`);
  return { error: error?.message ?? null };
}

// 마지막 플레이 시각 갱신(최근순 정렬용).
export async function touchStory(id) {
  const c = getClient();
  if (!c || !id) return;
  await c.from('stories').update({ updated_at: new Date().toISOString() }).eq('id', id);
}

// ── 기록 지침(전역 유저 커스텀 프롬프트) ───────────────────────────────────
//  settings 표의 단일 행(key='guidance')에 보관. 모든 이야기에 공통 주입.
//  ⚠️ settings 표가 아직 없으면(SQL 미실행) 조용히 ''/실패를 돌려준다 → 앱은 폴백.
//     SQL: create table if not exists settings (key text primary key, value text, updated_at timestamptz default now());
//  ⚠️ 2026-06-13 설계 변경: 기록 지침은 전역이 아니라 **장(이야기)별**이다(빌더 확정).
//  키 = `guidance:{storyId}` (settings 표 재사용 — 스키마 변경 없음). 옛 전역 행('guidance')은
//  더 안 읽는다(장을 옮겨도 지침이 따라가던 동작의 원인 — 잔존해도 무해).
const 지침키 = (storyId) => (storyId ? `guidance:${storyId}` : 'guidance');

export async function getGuidance(storyId) {
  const c = getClient();
  if (!c) return '';
  const { data, error } = await c
    .from('settings')
    .select('value')
    .eq('key', 지침키(storyId))
    .maybeSingle();
  if (error) {
    console.error('[보관소] 기록 지침 읽기 실패:', error.message);
    return '';
  }
  return data?.value ?? '';
}

export async function setGuidance(storyId, text) {
  const c = getClient();
  if (!c) return { ok: false, error: '보관소가 설정되지 않았습니다.' };
  const { error } = await c
    .from('settings')
    .upsert(
      { key: 지침키(storyId), value: text ?? '', updated_at: new Date().toISOString() },
      { onConflict: 'key' },
    );
  if (error) {
    console.error('[보관소] 기록 지침 기록 실패:', error.message);
    return { ok: false, error: error.message };
  }
  return { ok: true, error: null };
}

// ── 줄거리 요약(컨텍스트 윈도우용) ─────────────────────────────────────────
//  stories.summary       = 지금까지의 누적 줄거리(Gemini가 갱신)
//  stories.summary_turn_id = 요약이 '어디까지' 포함했는지(그 turn id까지)
//  ⚠️ 컬럼이 아직 없으면(SQL 미실행) 조용히 null을 돌려준다 → 앱은 기존대로 동작.
export async function getStoryMemory(storyId) {
  const c = getClient();
  if (!c || !storyId) return { summary: null, summaryTurnId: 0 };
  const { data, error } = await c
    .from('stories')
    .select('summary, summary_turn_id')
    .eq('id', storyId)
    .single();
  if (error) return { summary: null, summaryTurnId: 0 }; // 컬럼 미존재 등 — 안전 폴백
  return { summary: data?.summary ?? null, summaryTurnId: data?.summary_turn_id ?? 0 };
}

export async function setStoryMemory(storyId, summary, summaryTurnId) {
  const c = getClient();
  if (!c || !storyId) return;
  const { error } = await c
    .from('stories')
    .update({ summary, summary_turn_id: summaryTurnId })
    .eq('id', storyId);
  if (error) console.error('[보관소] 줄거리 저장 실패:', error.message);
}

// 이야기 완전 복제 — 본문(turns) + 인물 + 견문록을 통째로 새 슬롯에 복사.
export async function copyStory(sourceId) {
  const c = getClient();
  if (!c) return { error: 'Supabase 미설정' };

  const { data: src, error: e0 } = await c
    .from('stories')
    .select('title')
    .eq('id', sourceId)
    .single();
  if (e0 || !src) return { error: e0?.message || '원본 이야기를 찾을 수 없습니다.' };

  const { data: ns, error: e1 } = await c
    .from('stories')
    .insert({ title: `${src.title} - 필사` }) // 필사 = UI(src/strings.ts UI.copy)와 같은 단어 유지
    .select()
    .single();
  if (e1 || !ns) return { error: e1?.message || '복사본 생성 실패' };
  const newId = ns.id;

  // 본문 복사(순서 유지).
  const { data: turns } = await c
    .from('turns')
    .select('role, content')
    .eq('story_id', sourceId)
    .order('id', { ascending: true });
  if (turns?.length) {
    const rows = turns.map((t) => ({ role: t.role, content: t.content, story_id: newId }));
    const { error } = await c.from('turns').insert(rows);
    if (error) return { error: error.message };
  }

  // 인물·견문록 복사(id·created_at 제외, story_id 교체).
  for (const table of ['characters', 'lore']) {
    const { data } = await c.from(table).select('*').eq('story_id', sourceId).order('id', { ascending: true });
    if (data?.length) {
      const rows = data.map((row) => {
        const r = { ...row };
        delete r.id;
        delete r.created_at;
        r.story_id = newId;
        return r;
      });
      const { error } = await c.from(table).insert(rows);
      if (error) return { error: error.message };
    }
  }

  // 장별 기록 지침도 필사본에 함께(있을 때만).
  const 지침 = await getGuidance(sourceId);
  if (지침) await setGuidance(newId, 지침);

  return { story: ns };
}

// ── 인물(characters) ──────────────────────────────────────────────────────
// 편집 가능한 '커스텀 층' — 인물 프로필을 영구 저장/관리한다.

const 인물칸 = [
  'name',
  'english_name',
  'aliases',
  'base',
  'gender',
  'faction',
  'rank',
  'crest',
  'title',
  'appearance',
  'height',
  'build',
  'hair',
  'iris',
  'impression',
  'personality',
  'combat',
  'notes',
  'bonds',
  'analysis',
  'life_status',
  'is_active',
  'thumbnail',
  'avatar',
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

// 새 항목을 '맨 뒤'로 — 같은 이야기의 최대 sort_order + 1(없으면 0).
// (새 항목 기본값 0이 드래그로 매겨진 0·1·2…의 맨 앞 0과 겹쳐 '중간'에 끼던 것 방지.)
async function 다음정렬값(c, table, storyId) {
  let q = c
    .from(table)
    .select('sort_order')
    .order('sort_order', { ascending: false, nullsFirst: false })
    .limit(1);
  if (storyId) q = q.eq('story_id', storyId);
  const { data } = await q.maybeSingle();
  return (data?.sort_order ?? -1) + 1;
}

export async function saveCharacter(ch) {
  const c = getClient();
  if (!c) return { error: 'Supabase 미설정' };
  const row = 인물정제(ch);
  let res;
  if (ch.id) {
    res = await c.from('characters').update(row).eq('id', ch.id).select().single();
  } else {
    if (row.sort_order == null) row.sort_order = await 다음정렬값(c, 'characters', row.story_id);
    res = await c.from('characters').insert(row).select().single();
  }
  if (res.error) {
    console.error('[보관소] 인물 저장 실패:', res.error.message);
    return { error: res.error.message };
  }
  return { character: res.data };
}

// 한 인물의 전체 프로필을 불러온다(보고서 발급에 필요 — 약력·인연 포함).
export async function getCharacter(id) {
  const c = getClient();
  if (!c || !id) return null;
  const { data, error } = await c.from('characters').select('*').eq('id', id).single();
  if (error) {
    console.error('[보관소] 인물 단건 조회 실패:', error.message);
    return null;
  }
  return data ?? null;
}

// 한 인물의 분석 보고서(analysis JSONB)만 저장한다.
//  ⚠️ analysis 컬럼이 아직 없으면(SQL 미실행) 안내 메시지를 돌려준다 → UI가 빌더에게 알린다.
export async function setCharacterAnalysis(id, analysis) {
  const c = getClient();
  if (!c) return { error: 'Supabase 미설정' };
  const { error } = await c.from('characters').update({ analysis }).eq('id', id);
  if (error) {
    console.error('[보관소] 보고서 저장 실패:', error.message);
    const 컬럼없음 = /column .*analysis|analysis.* column|schema cache/i.test(error.message);
    return {
      error: 컬럼없음
        ? '보고서를 담을 자리가 아직 없습니다. characters 표에 analysis(jsonb) 칸을 한 번 만드십시오.'
        : error.message,
    };
  }
  return { error: null };
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
    .select(
      'name,english_name,aliases,gender,faction,rank,crest,personality,height,build,hair,iris,impression,combat,notes,base,bonds,life_status,is_active',
    )
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
// body = 섹션(sections)의 평문 거울(프런트가 동기화) → 주입·앵커는 body만 읽어도 됨.
const 견문록칸 = ['title', 'category', 'body', 'sections', 'is_active', 'sort_order', 'story_id'];

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
  if (!e.id && row.sort_order == null) row.sort_order = await 다음정렬값(c, 'lore', row.story_id);
  const run = (r) =>
    e.id
      ? c.from('lore').update(r).eq('id', e.id).select().single()
      : c.from('lore').insert(r).select().single();
  let res = await run(row);
  // sections 컬럼이 아직 없으면(스키마 미적용) → 그 칸만 빼고 재시도.
  // (평문은 body에 이미 동기화돼 있어 내용은 유실되지 않음. 구조만 다음 SQL 적용 후부터 보존)
  if (res.error && row.sections !== undefined && /sections/i.test(res.error.message)) {
    const { sections, ...rest } = row;
    res = await run(rest);
  }
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

// ── 서신(letters) — 인물 간 편지 (이야기별 분리·영구 누적) ───────────────────
//  설계 전체 = docs/서신_설계.md. 한 통 = 한 행, 발신·수신 양쪽 인물의 함에서 보인다.
//  ⚠️ letters 표가 아직 없으면(SQL 미실행) 조용히 빈 목록/안내를 돌려준다 → UI는 폴백.
//     SQL은 설계서 §1 참조(스키마 원문).

// 이야기의 서신을 불러온다. characterId를 주면 그 인물이 한쪽에라도 걸린 통만
// (등록 인물=id 매칭. 子·모브 쪽은 id가 null이라 항상 등록 쪽 id로 걸린다).
export async function listLetters(storyId, characterId = null) {
  const c = getClient();
  if (!c) return { letters: [], error: null };
  let q = c.from('letters').select('*').order('id', { ascending: false });
  if (storyId) q = q.eq('story_id', storyId);
  if (characterId) q = q.or(`sender_id.eq.${characterId},receiver_id.eq.${characterId}`);
  const { data, error } = await q;
  if (error) {
    console.error('[보관소] 서신 불러오기 실패:', error.message);
    return { letters: [], error: error.message };
  }
  return { letters: data ?? [], error: null };
}

// 새 서신(들)을 새긴다. 성공 시 발급된 id가 붙은 행을 돌려준다.
export async function saveLetters(rows) {
  const c = getClient();
  if (!c) return { letters: [], error: 'Supabase 미설정' };
  const { data, error } = await c.from('letters').insert(rows).select('*');
  if (error) {
    console.error('[보관소] 서신 기록 실패:', error.message);
    return { letters: [], error: error.message };
  }
  return { letters: data ?? [], error: null };
}

// 서신 한 통을 고친다 — 편집(제목·본문·서명) 또는 개봉(is_sealed=false).
export async function updateLetter(id, fields) {
  const c = getClient();
  if (!c) return { error: 'Supabase 미설정' };
  const allowed = {};
  for (const k of ['title', 'content', 'signature', 'is_sealed'])
    if (fields[k] !== undefined) allowed[k] = fields[k];
  const { error } = await c.from('letters').update(allowed).eq('id', id);
  if (error) console.error('[보관소] 서신 갱신 실패:', error.message);
  return { error: error?.message ?? null };
}

export async function deleteLetter(id) {
  const c = getClient();
  if (!c) return { error: 'Supabase 미설정' };
  const { error } = await c.from('letters').delete().eq('id', id);
  if (error) console.error('[보관소] 서신 소각 실패:', error.message);
  return { error: error?.message ?? null };
}
