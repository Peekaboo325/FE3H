// /api/stories — 이야기(세이브 슬롯) 관리.
//   GET                   → 목록 (최근 플레이순)
//   POST {title}          → 새 이야기
//   POST {id, title}      → 이름 바꾸기
//   DELETE ?id=123        → 삭제 (그 이야기의 본문도 cascade 삭제)

import { listStories, createStory, renameStory, deleteStory, copyStory, dbReady, getUsage, resetUsage } from '../lib/db.mjs';

export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  try {
    if (req.method === 'GET') {
      // API 사용 내역(빌더 진단) — 천각의 박동 패널이 읽는다. 새 함수 대신 서브모드(Hobby 12함수 한도).
      if (req.query?.usage) {
        res.status(200).end(JSON.stringify({ usage: await getUsage() }));
        return;
      }
      const { stories, error } = await listStories();
      res.status(200).end(JSON.stringify({ dbReady: dbReady(), stories, error }));
      return;
    }
    if (req.method === 'POST') {
      const { id, title, copy_from } = req.body || {};
      let r;
      if (copy_from) r = await copyStory(Number(copy_from));
      else if (id) r = await renameStory(Number(id), (title || '').trim() || '제목 없는 이야기');
      else r = await createStory((title || '').trim());
      res.status(r.error ? 500 : 200).end(JSON.stringify(r));
      return;
    }
    if (req.method === 'DELETE') {
      if (req.query?.usage) {
        // API 사용 내역 초기화(빌더 진단).
        const r = await resetUsage();
        res.status(r.error ? 500 : 200).end(JSON.stringify(r));
        return;
      }
      const id = req.query?.id ?? req.body?.id;
      const r = await deleteStory(Number(id));
      res.status(r.error ? 500 : 200).end(JSON.stringify(r));
      return;
    }
    res.status(405).end(JSON.stringify({ error: '지원하지 않는 방식입니다.' }));
  } catch (e) {
    res.status(500).end(JSON.stringify({ error: e?.message || String(e) }));
  }
}
