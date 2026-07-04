// /api/turns
//   GET ?story_id=123          → 그 이야기의 본문(턴) 목록 (+ dbReady/error)
//   GET ?story_id=123&last=1   → 마지막 턴 하나만(스트리밍 끊김 복구 확인용 — 전 회차 X)
//   GET ?turn_id=123           → 그 칸 하나의 content만(재작성 끊김 복구 확인용)
//   POST {id, content} → 한 턴 내용 수정
//   DELETE ?id=123     → 한 턴 삭제
//   DELETE ?story_id=7 → 그 장의 본문 전체 비우기(환원 — 연대 문헌도 함께 사라짐)

import { loadTurns, loadLastTurn, getTurnContent, updateTurn, deleteTurn, clearTurns, dbReady, setPolishedShow, savePolished, insertTurn } from '../lib/db.mjs';

export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  try {
    if (req.method === 'GET') {
      const storyId = req.query?.story_id ? Number(req.query.story_id) : null;
      // 재작성 복구 확인 — 그 칸 하나의 content만(끊긴 재작성을 서버가 끝내 저장했는지).
      if (req.query?.turn_id) {
        const { content } = await getTurnContent(Number(req.query.turn_id));
        res.status(200).end(JSON.stringify({ content }));
        return;
      }
      // 복구 확인 — 마지막 N턴만(전 회차 X). 끊긴 스트림이 서버엔 저장됐는지 가볍게 확인.
      //   ?last=2면 유저(초안/연출)+조수 두 칸 — 실행 후 초안 칸 id까지 복구하려 꼬리를 조금 더 받는다.
      if (req.query?.last) {
        const { turns, error } = await loadLastTurn(storyId, Number(req.query.last));
        res.status(200).end(JSON.stringify({ dbReady: dbReady(), turns, error }));
        return;
      }
      const { turns, error } = await loadTurns(storyId);
      res.status(200).end(JSON.stringify({ dbReady: dbReady(), turns, error }));
      return;
    }
    if (req.method === 'POST') {
      const { id, content, polished, polished_show, story_id, role } = req.body || {};
      if (!id) {
        // 친필 — 모델 호출 없이 조수(본문) 턴 하나 심기(id 없이 story_id+content).
        if (story_id && typeof content === 'string' && content.trim()) {
          const r = await insertTurn(Number(story_id), role === 'user' ? 'user' : 'assistant', String(content));
          res.status(r.error ? 500 : 200).end(JSON.stringify(r));
          return;
        }
        res.status(400).end(JSON.stringify({ error: 'id가 필요합니다.' }));
        return;
      }
      // 보기 토글만 영속화(원본↔교정본) — content 없이 polished_show만 온 경우.
      if (content === undefined && polished === undefined && polished_show !== undefined) {
        const r = await setPolishedShow(Number(id), polished_show);
        res.status(r.error ? 500 : 200).end(JSON.stringify(r));
        return;
      }
      // 교정본만 수정 — polished 칸만 갱신(원본·요약 불변).
      if (content === undefined && polished !== undefined) {
        const r = await savePolished(Number(id), String(polished ?? ''));
        res.status(r.error ? 500 : 200).end(JSON.stringify(r));
        return;
      }
      const r = await updateTurn(Number(id), String(content ?? ''));
      res.status(r.error ? 500 : 200).end(JSON.stringify(r));
      return;
    }
    if (req.method === 'DELETE') {
      const storyId = req.query?.story_id ?? req.body?.story_id;
      if (storyId) {
        const r = await clearTurns(Number(storyId)); // 환원
        res.status(r.error ? 500 : 200).end(JSON.stringify(r));
        return;
      }
      const id = req.query?.id ?? req.body?.id;
      const r = await deleteTurn(Number(id));
      res.status(r.error ? 500 : 200).end(JSON.stringify(r));
      return;
    }
    res.status(405).end(JSON.stringify({ error: '지원하지 않는 방식입니다.' }));
  } catch (e) {
    res.status(500).end(JSON.stringify({ error: e?.message || String(e) }));
  }
}
