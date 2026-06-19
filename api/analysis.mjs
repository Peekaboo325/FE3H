// /api/analysis — 인물 분석 계열 통합 입구 (보고서·임무·소지품·일지).
//   Vercel Hobby는 한 배포에 서버리스 함수 12개까지 → report·quests·items·journal 네 입구를
//   이 한 함수로 합쳐 함수 수를 줄였다(각 기능의 두뇌 lib/*.mjs는 그대로, 여기선 얇은 라우팅만).
//   갈래 = 쿼리 ?kind=report|quests|items|journal. 그 안에서 메서드별 처리:
//     report  POST {character_id, story_id?, instruction?}
//     quests  POST {character_id, story_id}
//     items   POST {character_id, story_id} / PUT {character_id, order[]} / DELETE ?character_id&id
//     journal POST {character_id, story_id} / PUT {character_id, id, title?, body?} / DELETE ?character_id&id
//   로컬 Express(server/index.mjs)도 이 핸들러를 그대로 가져다 써 로컬·배포가 한 입으로 움직인다.

import { runReport } from '../lib/report.mjs';
import { runQuests } from '../lib/quests.mjs';
import { runItems, removeItem, reorderItems } from '../lib/items.mjs';
import { runJournal, updateJournal, removeJournal } from '../lib/journal.mjs';
import { dbReady } from '../lib/db.mjs';

const GEMINI_없음 = '분석관과의 통로가 아직 닫혀 있습니다(GEMINI_API_KEY 없음).';
const 미지원 = '지원하지 않는 방식입니다.';

export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  const kind = req.query?.kind || '';
  const 숫자 = (v) => (v ? Number(v) : null);
  const characterId = 숫자(req.body?.character_id ?? req.query?.character_id);
  const storyId = 숫자(req.body?.story_id ?? req.query?.story_id);
  const 보냄 = (r) =>
    res.status(r.error ? 500 : 200).end(JSON.stringify({ dbReady: dbReady(), ...r }));
  const 막음 = (code, error) => res.status(code).end(JSON.stringify({ error }));
  const 제미니막힘 = () => !process.env.GEMINI_API_KEY;

  try {
    switch (kind) {
      case 'report': {
        if (req.method !== 'POST') return 막음(405, 미지원);
        if (제미니막힘()) return 막음(400, GEMINI_없음);
        const instruction = (req.body?.instruction || '').trim();
        return 보냄(await runReport({ characterId, storyId, customInstruction: instruction }));
      }
      case 'quests': {
        if (req.method !== 'POST') return 막음(405, 미지원);
        if (제미니막힘()) return 막음(400, GEMINI_없음);
        return 보냄(await runQuests({ characterId, storyId }));
      }
      case 'items': {
        if (req.method === 'POST') {
          if (제미니막힘()) return 막음(400, GEMINI_없음);
          return 보냄(await runItems({ characterId, storyId }));
        }
        if (req.method === 'PUT') {
          const order = Array.isArray(req.body?.order) ? req.body.order : null;
          return 보냄(await reorderItems({ characterId, order }));
        }
        if (req.method === 'DELETE') return 보냄(await removeItem({ characterId, itemId: req.query?.id || null }));
        return 막음(405, 미지원);
      }
      case 'journal': {
        if (req.method === 'POST') {
          if (제미니막힘()) return 막음(400, GEMINI_없음);
          return 보냄(await runJournal({ characterId, storyId }));
        }
        if (req.method === 'PUT') {
          return 보냄(
            await updateJournal({
              characterId,
              entryId: req.body?.id || null,
              title: req.body?.title,
              body: req.body?.body,
            }),
          );
        }
        if (req.method === 'DELETE') return 보냄(await removeJournal({ characterId, entryId: req.query?.id || null }));
        return 막음(405, 미지원);
      }
      default:
        return 막음(400, '알 수 없는 분석 갈래입니다(kind).');
    }
  } catch (e) {
    return 막음(500, e?.message || String(e));
  }
}
