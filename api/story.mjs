// ─────────────────────────────────────────────────────────────────────────
//  /api/story — Vercel 서버리스 함수 버전의 '서고'.
//
//  로컬 개발에선 server/index.mjs(Express)가 이 역할을 하고,
//  Vercel 배포에선 이 파일이 그 역할을 한다. 하는 일:
//    열쇠를 쥐고 → 박제 세계관을 주입해 → 클로드 본문을 스트리밍하고,
//    유저 입력과 완성된 본문을 Supabase에 영구 저장한다.
//
//  열쇠(ANTHROPIC_API_KEY, SUPABASE_*)는 Vercel 환경 변수에 넣는다.
// ─────────────────────────────────────────────────────────────────────────

import Anthropic from '@anthropic-ai/sdk';
import { SYSTEM } from '../lib/worldview.mjs';
import { saveTurn, touchStory, loadCharactersForInjection, loadLoreForInjection, getGuidance } from '../lib/db.mjs';
import { buildGuidanceBlock } from '../lib/guidance.mjs';
import { buildCharacterContext } from '../lib/charContext.mjs';
import { buildLoreContext } from '../lib/loreContext.mjs';
import { prepareConversation, buildSummaryBlock } from '../lib/memory.mjs';
import {
  parseAnchors,
  buildAnchorContext,
  parseLoreAnchors,
  buildLoreAnchorContext,
} from '../lib/anchor.mjs';

const MODEL = 'claude-opus-4-8'; // 메인 본문 = Opus 4.8 (CLAUDE.md)

export const config = { maxDuration: 60 };

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).end('POST만 받습니다.');
    return;
  }

  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) {
    res.status(400).setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.end(
      '[서고] 아직 클로드 API 열쇠가 꽂히지 않았습니다.\n' +
        'Vercel 프로젝트 설정 → Environment Variables 에 ANTHROPIC_API_KEY 를 추가하고 다시 배포해 주세요.',
    );
    return;
  }

  const messages = Array.isArray(req.body?.messages) ? req.body.messages : [];
  if (messages.length === 0) {
    res.status(400).setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.end('[서고] 입력이 비어 있습니다.');
    return;
  }

  const storyId = req.body?.story_id ? Number(req.body.story_id) : null;

  // 이번 차례의 새 유저 입력을 먼저 영구 저장한다(설정돼 있으면).
  const 새입력 = messages[messages.length - 1];
  if (새입력?.role === 'user') await saveTurn('user', 새입력.content, storyId);

  // 컨텍스트 윈도우: 전체 대화 대신 '줄거리 요약 + 최근 N턴 원문'으로 재구성.
  // + 앵커링: "N화 참고"(회차) / "제N권·(제목) 참조"(문헌)를 지목했으면 골라 주입.
  const 입력문 = 새입력?.role === 'user' ? 새입력.content : '';
  // 화수는 LLM 추론에 맡기지 않고 확정값을 주입한다(§5). N번째 본문 = 제N화.
  const 화수 = messages.filter((m) => m?.role === 'assistant').length + 1;
  const 지목 = parseAnchors(입력문);
  const 견문록지목 = parseLoreAnchors(입력문);
  const [{ messages: 대화, summary: 줄거리 }, 참고, 견문록참고] = await Promise.all([
    prepareConversation(storyId, messages),
    지목.length ? buildAnchorContext(storyId, 입력문, 지목) : Promise.resolve({ block: null, episodes: [] }),
    견문록지목.refs.length || 견문록지목.titles.length
      ? buildLoreAnchorContext(storyId, 견문록지목)
      : Promise.resolve({ block: null, items: [] }),
  ]);

  // 활성 견문록(세계 설정) + 활성 인물을 박제 세계관 뒤에 붙인다(캐싱 유지).
  const [설정원천, 인물원천, 지침] = await Promise.all([
    loadLoreForInjection(storyId),
    loadCharactersForInjection(storyId),
    getGuidance(storyId).catch(() => ''), // 기록 지침(장별) — 없으면 ''
  ]);
  const 설정블록 = buildLoreContext(설정원천);
  const 인물블록 = buildCharacterContext(인물원천);
  const 지침블록 = buildGuidanceBlock(지침);
  const 줄거리블록 = buildSummaryBlock(줄거리);
  const system = [{ type: 'text', text: SYSTEM, cache_control: { type: 'ephemeral' } }];
  if (지침블록) system.push({ type: 'text', text: 지침블록 }); // 기록자 추가 지침(박제 세계관 바로 뒤)
  if (설정블록) system.push({ type: 'text', text: 설정블록 });
  if (인물블록) system.push({ type: 'text', text: 인물블록 });
  if (줄거리블록) system.push({ type: 'text', text: 줄거리블록 }); // 대화 앞 = 최신 맥락
  system.push({
    type: 'text',
    text:
      `[이번 회차 번호 — 확정]\n지금 집필하는 것은 제${화수}화다. ` +
      `머리글 "## 제N화 · 제목"의 N에는 반드시 ${화수}을(를) 쓴다. ` +
      `화수를 스스로 세거나 다른 숫자를 쓰지 말 것.`,
  });
  if (견문록참고.block) system.push({ type: 'text', text: 견문록참고.block }); // 지목 문헌
  if (참고.block) system.push({ type: 'text', text: 참고.block }); // 지목 회차 = 가장 가까이

  const client = new Anthropic({ apiKey: key });
  res.status(200).setHeader('Content-Type', 'text/plain; charset=utf-8');
  // 스트림이 프록시에 버퍼링·변형돼 끊기지 않게(간헐적 끊김 대비).
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('X-Accel-Buffering', 'no');

  // 실제로 되짚은 회차·문헌을 헤더로 — 클라가 그 화에 '확인 자취'를 남긴다(본문 전에 전송).
  const 자취 = {};
  if (참고.episodes.length) 자취.ep = 참고.episodes;
  if (견문록참고.items.length) 자취.lore = 견문록참고.items;
  if (자취.ep || 자취.lore) {
    res.setHeader('x-recall', encodeURIComponent(JSON.stringify(자취)));
  }

  let 본문 = '';
  try {
    const stream = client.messages.stream({
      model: MODEL,
      max_tokens: 8000,
      thinking: { type: 'adaptive' },
      output_config: { effort: 'medium' }, // 사실 정밀도 실험(2026-06-13, 빌더 승인) — 끊김(60초) 재발 시 low 회귀 또는 Vercel Pro
      system,
      messages: 대화,
    });

    stream.on('text', (delta) => {
      본문 += delta;
      res.write(delta);
    });
    await stream.finalMessage();

    // 완성된 본문을 영구 저장하고, 이야기의 최근 플레이 시각을 갱신한다.
    if (본문.trim()) {
      await saveTurn('assistant', 본문, storyId);
      await touchStory(storyId);
    }
    res.end();
  } catch (err) {
    const 사유 = err?.message || String(err);
    console.error('[서고] 클로드 호출 오류:', 사유);
    res.write(`\n\n[서고 오류] 본문 생성에 실패했습니다: ${사유}`);
    res.end();
  }
}
