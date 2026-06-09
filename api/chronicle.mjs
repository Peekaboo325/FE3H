// /api/chronicle — 연대 문헌(화별 요약) 조회.
//  화 목록 + 각 화의 요약을 돌려준다. 요약이 빠진 화는 그 자리에서 생성·저장(lazy).
//  요약 컬럼이 없으면 ready:false → 제목만 보여주고 안내.

import { loadTurnsForSummary, dbReady, getTurnContent, setTurnSummary } from '../lib/db.mjs';
import { ensureEpisodeSummaries, buildChronicle } from '../lib/chronicle.mjs';
import { summarizeEpisode } from '../lib/summarize.mjs';

export const config = { maxDuration: 60 };

export default async function handler(req, res) {
  // POST { turn_id } → 그 화를 다시 요약(잘리거나 갱신하고 싶을 때).
  if (req.method === 'POST') {
    const id = Number(req.body?.turn_id);
    if (!id) {
      res.status(400).json({ ok: false, error: '화를 특정할 수 없습니다.' });
      return;
    }
    try {
      const content = await getTurnContent(id);
      if (!content) {
        res.status(200).json({ ok: false, error: '그 화의 본문을 찾지 못했습니다.' });
        return;
      }
      const summary = await summarizeEpisode(content);
      if (!summary) {
        res.status(200).json({ ok: false, error: '기록의 샘이 잠시 붐벼 다시 적지 못했습니다.' });
        return;
      }
      await setTurnSummary(id, summary);
      res.status(200).json({ ok: true, summary });
    } catch (e) {
      res.status(200).json({ ok: false, error: e?.message || String(e) });
    }
    return;
  }

  const storyId = req.query?.story_id ? Number(req.query.story_id) : null;
  try {
    const { turns, hasSummaryCol } = await loadTurnsForSummary(storyId);
    if (hasSummaryCol && storyId) await ensureEpisodeSummaries(turns); // 빠진 요약 채움
    res.status(200).json({
      dbReady: dbReady(),
      ready: hasSummaryCol,
      chronicle: buildChronicle(turns),
    });
  } catch (e) {
    res.status(200).json({ dbReady: dbReady(), ready: false, chronicle: [], error: e?.message || String(e) });
  }
}
