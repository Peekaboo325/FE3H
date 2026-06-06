// /api/chronicle — 연대 문헌(화별 요약) 조회.
//  화 목록 + 각 화의 요약을 돌려준다. 요약이 빠진 화는 그 자리에서 생성·저장(lazy).
//  요약 컬럼이 없으면 ready:false → 제목만 보여주고 안내.

import { loadTurnsForSummary, dbReady } from '../lib/db.mjs';
import { ensureEpisodeSummaries, buildChronicle } from '../lib/chronicle.mjs';

export const config = { maxDuration: 60 };

export default async function handler(req, res) {
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
