// /api/regen — 한 답변을 '다시 받기'.
//   body: { messages, story_id, turn_id }
//   messages = 앞 대화 + 그 프롬프트까지(매칭 답변·이후는 미포함).
//   새 유저 턴은 저장하지 않고, 생성된 본문으로 turn_id 칸만 갱신한다.

import Anthropic from '@anthropic-ai/sdk';
import { SYSTEM } from '../lib/worldview.mjs';
import { updateTurn, loadCharactersForInjection, loadLoreForInjection, getGuidance } from '../lib/db.mjs';
import { buildGuidanceBlock } from '../lib/guidance.mjs';
import { genConfig } from '../lib/genConfig.mjs';
import { 서술자키, 서술자클라이언트, 사고옵션, 모델별지침, 양식가드, 머리글게이트, 직전화날짜 } from '../lib/llm.mjs';
import { buildCharacterContext } from '../lib/charContext.mjs';
import { buildLoreContext } from '../lib/loreContext.mjs';
import {
  parseAnchors,
  buildAnchorContext,
  parseLoreAnchors,
  buildLoreAnchorContext,
  buildCharacterAnchorContext,
} from '../lib/anchor.mjs';

const MODEL = 'claude-opus-4-8';
export const config = { maxDuration: 300 }; // 긴 화도 60초 천장 없이 완결. 진짜 천장 = 이 값 + Fluid compute(플랜 아님): 300초 = Hobby(Fluid ON)·Pro 공통(2026-06-19 정정·DEVLOG)

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).end('POST만 받습니다.');
    return;
  }
  const { model, effort } = genConfig(req.body); // 서술자 모델·사고 깊이. DeepSeek도 허용
  const key = 서술자키(model); // 제공자에 맞는 키(클로드=ANTHROPIC / DeepSeek=DEEPSEEK)
  if (!key) {
    res.status(400).setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.end(`[서고] ${model.startsWith('deepseek') ? 'DEEPSEEK_API_KEY' : 'ANTHROPIC_API_KEY'} 가 없습니다.`);
    return;
  }
  const messages = Array.isArray(req.body?.messages) ? req.body.messages : [];
  const storyId = req.body?.story_id ? Number(req.body.story_id) : null;
  const turnId = req.body?.turn_id ? Number(req.body.turn_id) : null;
  if (messages.length === 0 || !turnId) {
    res.status(400).setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.end('[서고] 잘못된 재생성 요청입니다.');
    return;
  }

  // 앵커링(다시받기도 전개와 동일) — 재생성하는 그 턴의 유저 프롬프트에서 "(N화 참고)"·"제N권 참조"·"이름 등장"을 살린다.
  const 새입력 = messages[messages.length - 1];
  const 입력문 = 새입력?.role === 'user' ? 새입력.content : '';
  const 지목 = parseAnchors(입력문);
  const 견문록지목 = parseLoreAnchors(입력문);
  const [설정원천, 인물원천, 지침, 참고, 견문록참고, 인물참고] = await Promise.all([
    loadLoreForInjection(storyId),
    loadCharactersForInjection(storyId),
    getGuidance(storyId).catch(() => ''), // 기록 지침(장별) — 없으면 ''
    지목.length ? buildAnchorContext(storyId, 입력문, 지목) : Promise.resolve({ block: null, episodes: [] }),
    견문록지목.refs.length || 견문록지목.titles.length
      ? buildLoreAnchorContext(storyId, 견문록지목)
      : Promise.resolve({ block: null, items: [] }),
    입력문.includes('등장')
      ? buildCharacterAnchorContext(storyId, 입력문)
      : Promise.resolve({ block: null, chars: [] }),
  ]);
  const 설정블록 = buildLoreContext(설정원천);
  const 인물블록 = buildCharacterContext(인물원천);
  const 지침블록 = buildGuidanceBlock(지침);
  const 화수 = messages.filter((m) => m?.role === 'assistant').length + 1; // 그 턴의 화수(§5)
  // 프롬프트 캐싱 — 블록마다 경계(1h). 세계관/문헌/지침/인물(story와 동일 구조·프리픽스 = 캐시 공유).
  //  인물 토글 = 인물 칸만 재기록(앞 블록 캐시 유지). 화수는 매 턴 바뀌므로 경계 없음.
  const 캐시 = { type: 'ephemeral', ttl: '1h' };
  const system = [{ type: 'text', text: SYSTEM, cache_control: 캐시 }];
  if (설정블록) system.push({ type: 'text', text: 설정블록, cache_control: 캐시 }); // 대륙 문헌(활성)
  if (지침블록) system.push({ type: 'text', text: 지침블록, cache_control: 캐시 }); // 기록 지침
  if (인물블록) system.push({ type: 'text', text: 인물블록, cache_control: 캐시 }); // 인물(활성)
  system.push({
    type: 'text',
    text:
      `[이번 회차 번호 — 확정]\n지금 집필하는 것은 제${화수}화다. ` +
      `머리글 "## 제N화 · 제목"의 N에는 반드시 ${화수}을(를) 쓴다. ` +
      `화수를 스스로 세거나 다른 숫자를 쓰지 말 것.`,
  });
  if (인물참고.block) system.push({ type: 'text', text: 인물참고.block }); // 지목 인물 소환(캐시 경계 뒤)
  if (견문록참고.block) system.push({ type: 'text', text: 견문록참고.block }); // 지목 문헌
  if (참고.block) system.push({ type: 'text', text: 참고.block }); // 지목 회차 = 가장 가까이

  const client = 서술자클라이언트(model); // Opus/Sonnet=Anthropic, DeepSeek=Anthropic 호환 엔드포인트
  res.status(200).setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('X-Accel-Buffering', 'no');

  // 되짚은 자취(살린 것)·안내(못 살린 것)를 헤더로 — 클라가 토스트(전개와 동일). 다시받기도 앵커 반영.
  const 자취 = {};
  if (참고.episodes.length) 자취.ep = 참고.episodes;
  if (견문록참고.items.length) 자취.lore = 견문록참고.items;
  if (인물참고.chars.length) 자취.char = 인물참고.chars;
  if (자취.ep || 자취.lore || 자취.char) res.setHeader('x-recall', encodeURIComponent(JSON.stringify(자취)));
  const 안내 = {};
  if (참고.missNums?.length) 안내.epMiss = 참고.missNums;
  if (참고.briefFailed) 안내.epBrief = true;
  const 견문록의도 = 견문록지목.refs.length || 견문록지목.titles.length;
  if (견문록의도 && !견문록참고.items.length) 안내.loreMiss = true;
  if (인물참고.here?.length) 안내.charHere = 인물참고.here;
  if (인물참고.miss?.length) 안내.charMiss = 인물참고.miss;
  if (안내.epMiss || 안내.epBrief || 안내.loreMiss || 안내.charHere || 안내.charMiss) {
    res.setHeader('x-recall-note', encodeURIComponent(JSON.stringify(안내)));
  }

  let 본문 = '';
  const 게이트 = 머리글게이트(화수, 직전화날짜(messages), (s) => res.write(s)); // 머리글 누락 결정론적 보강
  try {
    const stream = client.messages.stream({
      model,
      max_tokens: 8000,
      ...사고옵션(model, effort), // 클로드=adaptive+effort / DeepSeek=thinking enabled (lib/llm.mjs)
      system: [...system, ...모델별지침(model), 양식가드], // DeepSeek 보정+수위가산을 끝에, 양식가드는 그보다 더 뒤(recency)
      messages,
    });
    stream.on('text', (delta) => 게이트.먹임(delta));
    const _final = await stream.finalMessage();
    게이트.닫기();
    본문 = 게이트.값();
    const u = _final?.usage;
    if (u)
      console.log(
        `[비용] regen 화${화수} in:${u.input_tokens ?? '-'} cw:${u.cache_creation_input_tokens ?? '-'} cr:${u.cache_read_input_tokens ?? '-'} out:${u.output_tokens ?? '-'}`,
      );
    if (본문.trim()) await updateTurn(turnId, 본문, true); // 그 칸만 갱신 + 요약 무효화(재생성)
    res.end();
  } catch (err) {
    const 사유 = err?.message || String(err);
    console.error('[서고] 재생성 오류:', 사유);
    res.write(`\n\n[서고 오류] 재생성에 실패했습니다: ${사유}`);
    res.end();
  }
}
