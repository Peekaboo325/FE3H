// /api/regen — 한 답변을 '다시 받기'.
//   body: { messages, story_id, turn_id }
//   messages = 앞 대화 + 그 프롬프트까지(매칭 답변·이후는 미포함).
//   새 유저 턴은 저장하지 않고, 생성된 본문으로 turn_id 칸만 갱신한다.

import Anthropic from '@anthropic-ai/sdk';
import { SYSTEM } from '../lib/worldview.mjs';
import { updateTurn, loadCharactersForInjection, loadLoreForInjection, getGuidance } from '../lib/db.mjs';
import { buildGuidanceBlock } from '../lib/guidance.mjs';
import { genConfig } from '../lib/genConfig.mjs';
import { 서술자키, 서술자클라이언트, 사고옵션, 모델별지침 } from '../lib/llm.mjs';
import { buildCharacterContext } from '../lib/charContext.mjs';
import { buildLoreContext } from '../lib/loreContext.mjs';

const MODEL = 'claude-opus-4-8';
export const config = { maxDuration: 300 }; // Vercel Pro — 긴 화도 60초 천장 없이 완결(2026-06-13)

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

  const [설정원천, 인물원천, 지침] = await Promise.all([
    loadLoreForInjection(storyId),
    loadCharactersForInjection(storyId),
    getGuidance(storyId).catch(() => ''), // 기록 지침(장별) — 없으면 ''
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

  const client = 서술자클라이언트(model); // Opus/Sonnet=Anthropic, DeepSeek=Anthropic 호환 엔드포인트
  res.status(200).setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('X-Accel-Buffering', 'no');

  let 본문 = '';
  try {
    const stream = client.messages.stream({
      model,
      max_tokens: 8000,
      ...사고옵션(model, effort), // 클로드=adaptive+effort / DeepSeek=thinking enabled (lib/llm.mjs)
      system: [...system, ...모델별지침(model)], // DeepSeek 한정 보정 지침을 끝에 덧댐(Opus엔 빈 배열)
      messages,
    });
    stream.on('text', (delta) => {
      본문 += delta;
      res.write(delta);
    });
    const _final = await stream.finalMessage();
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
