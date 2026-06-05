// ─────────────────────────────────────────────────────────────────────────
//  /api/story — Vercel 서버리스 함수 버전의 '서고'.
//
//  로컬 개발에선 server/index.mjs(Express)가 이 역할을 하고,
//  Vercel 배포에선 이 파일이 그 역할을 한다. 둘 다 하는 일은 같다:
//    열쇠를 쥐고 → 박제 세계관을 주입해 → 클로드 본문을 스트리밍한다.
//
//  열쇠(ANTHROPIC_API_KEY)는 Vercel 프로젝트 설정의 '환경 변수'에 넣는다.
// ─────────────────────────────────────────────────────────────────────────

import Anthropic from '@anthropic-ai/sdk';
import { SYSTEM } from '../lib/worldview.mjs';

const MODEL = 'claude-opus-4-8'; // 메인 본문 = Opus 4.8 (CLAUDE.md)

// Vercel 함수가 본문 생성을 기다릴 수 있는 최대 시간(초). 본문이 길어질 수 있어 넉넉히.
export const config = { maxDuration: 60 };

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).end('POST만 받습니다.');
    return;
  }

  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) {
    res
      .status(400)
      .setHeader('Content-Type', 'text/plain; charset=utf-8');
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

  const client = new Anthropic({ apiKey: key });

  res.status(200).setHeader('Content-Type', 'text/plain; charset=utf-8');

  try {
    const stream = client.messages.stream({
      model: MODEL,
      max_tokens: 8000, // 폭주 방지용 안전벨트. 길이는 프롬프트(한 화=한 장면)로 제어.
      thinking: { type: 'adaptive' }, // extended thinking 켜되 짧게 (CLAUDE.md)
      output_config: { effort: 'low' }, // 노력 '낮음' (CLAUDE.md)
      system: [
        {
          type: 'text',
          text: SYSTEM,
          cache_control: { type: 'ephemeral' }, // 고정 세계관 → 프롬프트 캐싱
        },
      ],
      messages,
    });

    stream.on('text', (delta) => res.write(delta));
    await stream.finalMessage();
    res.end();
  } catch (err) {
    const 사유 = err?.message || String(err);
    console.error('[서고] 클로드 호출 오류:', 사유);
    res.write(`\n\n[서고 오류] 본문 생성에 실패했습니다: ${사유}`);
    res.end();
  }
}
