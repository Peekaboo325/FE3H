// ─────────────────────────────────────────────────────────────────────────
//  에셋 보관소 — Supabase Storage. 큰 그림(인물 초상·얼굴)은 DB '행'이 아니라 여기에 둔다.
//
//  왜: 그림을 base64로 행에 박으면, 목록을 읽을 때마다 본문처럼 통째로 딸려 나와
//  (인물 명부 한 번 펼침 = 수 MB) Supabase egress를 폭증시킨다. Storage에 두면
//  DB 응답은 'URL 한 줄'로 줄고, 그림은 CDN에서 와 'Cached Egress'(별도·넉넉한 통)에
//  잡히며 브라우저·CDN이 캐싱한다 — CLAUDE.md §6이 원래 정한 방식.
//
//  열쇠는 db.mjs가 쥔다(service_role). 여기선 그 클라이언트만 빌려 쓴다. 브라우저는 이 파일을 모른다.
// ─────────────────────────────────────────────────────────────────────────

import { randomUUID } from 'node:crypto';
import { getClient } from './db.mjs';

const BUCKET = 'portraits'; // 인물 초상·얼굴 전용 공개 버킷(공개라야 공개 URL·CDN 캐싱이 선다).
let _bucketReady = false;

// 버킷이 없으면 공개로 만든다(있으면 그대로 둔다). 워밍된 인스턴스에선 한 번만 확인.
async function ensureBucket(c) {
  if (_bucketReady) return;
  const { error } = await c.storage.createBucket(BUCKET, { public: true });
  if (error && !/exist/i.test(error.message || '')) {
    console.error('[에셋] 버킷 생성 실패:', error.message);
  }
  _bucketReady = true;
}

// data:image/...;base64,... 한 장을 Storage에 올리고 공개 URL을 돌려준다.
//  ⚠️ 이미 URL(또는 빈 값)이면 변환 없이 그대로 통과 → 수정 저장 때 안 바뀐 그림은 재업로드되지 않는다.
//  실패하면 원본(base64)을 그대로 돌려준다 → 앱은 깨지지 않고, 다음 저장 때 다시 시도된다.
export async function 초상올리기(value, keyHint = 'x') {
  if (!value || !/^data:image\//i.test(value)) return value ?? '';
  const m = value.match(/^data:(image\/[a-z0-9.+-]+);base64,(.+)$/i);
  if (!m) return value;
  const c = getClient();
  if (!c) return value; // 보관소 미설정(휘발 모드) — base64 그대로
  const mime = m[1];
  const ext = mime.split('/')[1].replace('jpeg', 'jpg').replace('svg+xml', 'svg');
  const bytes = Buffer.from(m[2], 'base64');
  await ensureBucket(c);
  const path = `${keyHint}/${randomUUID()}.${ext}`;
  const { error } = await c.storage.from(BUCKET).upload(path, bytes, { contentType: mime, upsert: false });
  if (error) {
    console.error('[에셋] 초상 업로드 실패:', error.message);
    return value;
  }
  const { data } = c.storage.from(BUCKET).getPublicUrl(path);
  return data?.publicUrl || value;
}

// 한 번 돌리는 이전 작업 — 기존 인물의 base64 초상/얼굴을 Storage로 옮긴다.
//  data:만 골라 변환하므로 여러 번 호출해도 안전(이미 URL인 건 건너뜀). 멱등.
export async function migratePortraits() {
  const c = getClient();
  if (!c) return { error: 'Supabase 미설정' };
  const { data, error } = await c.from('characters').select('id, story_id, thumbnail, avatar');
  if (error) return { error: error.message };
  let moved = 0;
  for (const ch of data ?? []) {
    const patch = {};
    if (/^data:image\//i.test(ch.thumbnail || '')) {
      patch.thumbnail = await 초상올리기(ch.thumbnail, `${ch.story_id ?? 'x'}/thumb`);
    }
    if (/^data:image\//i.test(ch.avatar || '')) {
      patch.avatar = await 초상올리기(ch.avatar, `${ch.story_id ?? 'x'}/face`);
    }
    if (Object.keys(patch).length) {
      const { error: ue } = await c.from('characters').update(patch).eq('id', ch.id);
      if (!ue) moved++;
    }
  }
  return { moved, total: data?.length ?? 0 };
}
