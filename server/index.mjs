// ─────────────────────────────────────────────────────────────────────────
//  서고(書庫) — 브라우저와 클로드 사이에 선 얇은 서버 한 겹.
//
//  하는 일:
//   1. 클로드 API 열쇠를 (브라우저가 아니라) 여기 서버에서만 쥔다.
//   2. md/ 폴더의 '박제' 세계관 문서들을 시스템 프롬프트로 조립한다.
//   3. 유저 입력을 받아 클로드 Opus 4.8에게 본문을 청하고,
//      생성되는 문장을 실시간(스트리밍)으로 브라우저에 흘려보낸다.
//
//  이 파일은 v2.0 설계의 '서버 한 겹'을 가장 작게 구현한 씨앗이다.
//  나중에 Supabase Edge Functions로 옮겨가도 이 구조는 거의 그대로다.
// ─────────────────────────────────────────────────────────────────────────

import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import Anthropic from '@anthropic-ai/sdk';

const PORT = process.env.PORT || 8787;
const MODEL = 'claude-opus-4-8'; // 메인 본문 = Opus 4.8 (CLAUDE.md 모델 분배 규칙)

// ── 박제 세계관 문서 조립 ────────────────────────────────────────────────
// '박제 4종'만 시스템 프롬프트로 직접 주입한다(원작 정사 + 작법 규칙).
// 인물 노트·연재 설정 같은 '커스텀' 층은 나중에 DB에서 선택 주입할 자리다.
const 박제문서 = [
  '풍화설월_세계관_규약.md',
  '풍화설월_프로젝트_지침.md',
  '성인향_묘사_지침.md',
  '풍화설월_고유명사_사전.md',
];

function 세계관_조립() {
  const mdDir = path.resolve(process.cwd(), 'md');
  const 조각 = [];
  for (const 파일 of 박제문서) {
    const 경로 = path.join(mdDir, 파일);
    try {
      조각.push(fs.readFileSync(경로, 'utf-8').trim());
    } catch {
      console.warn(`[서고] 세계관 문서를 못 찾음: ${파일} (건너뜀)`);
    }
  }
  const 머리말 =
    "당신은 '파이어 엠블렘 풍화설월' 세계를 무대로 한 인터랙티브 픽션의 서술자다. " +
    '아래 문서들은 이 세계의 표기·용어·작법의 단일 출처다. ' +
    '유저의 입력에 이어, 한국어 본문으로 이야기를 이어간다. ' +
    '안내 멘트나 사고 과정 노출 없이, 작가로서의 본문이나 인물로서의 대사만 출력한다.';
  return `${머리말}\n\n${조각.join('\n\n---\n\n')}`;
}

const SYSTEM = 세계관_조립();
console.log(`[서고] 세계관 박제 ${SYSTEM.length.toLocaleString()}자 적재 완료.`);

// ── 서버 ──────────────────────────────────────────────────────────────────
const app = express();
app.use(express.json({ limit: '1mb' }));

app.post('/api/story', async (req, res) => {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) {
    // 열쇠가 아직 안 꽂힌 상태 — 친절히 알린다.
    res.status(400).type('text/plain; charset=utf-8');
    res.end(
      '[서고] 아직 클로드 API 열쇠가 꽂히지 않았습니다.\n' +
        '.env 파일에 ANTHROPIC_API_KEY 값을 넣고 서버를 다시 켜 주세요.',
    );
    return;
  }

  const messages = Array.isArray(req.body?.messages) ? req.body.messages : [];
  if (messages.length === 0) {
    res.status(400).type('text/plain; charset=utf-8').end('[서고] 입력이 비어 있습니다.');
    return;
  }

  const client = new Anthropic({ apiKey: key });

  // 본문은 길어질 수 있으니 스트리밍으로 흘려보낸다(체감 대기 감소).
  res.status(200).type('text/plain; charset=utf-8');

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
          cache_control: { type: 'ephemeral' }, // 고정 세계관 → 프롬프트 캐싱(반복 입력 절감)
        },
      ],
      messages,
    });

    // 'text' 이벤트는 본문 텍스트 조각만 흘려준다(사고 과정은 제외).
    stream.on('text', (delta) => res.write(delta));

    await stream.finalMessage();
    res.end();
  } catch (err) {
    // 모델 호출 실패 시, 브라우저가 멈춘 듯 보이지 않게 사유를 흘려보낸다.
    const 사유 = err?.message || String(err);
    console.error('[서고] 클로드 호출 오류:', 사유);
    if (!res.headersSent) res.status(500).type('text/plain; charset=utf-8');
    res.write(`\n\n[서고 오류] 본문 생성에 실패했습니다: ${사유}`);
    res.end();
  }
});

app.listen(PORT, () => {
  console.log(`[서고] 포트 ${PORT}에서 깨어남. 클로드와의 통로 열림.`);
  if (!process.env.ANTHROPIC_API_KEY) {
    console.log('[서고] (아직 ANTHROPIC_API_KEY 없음 — .env에 열쇠를 꽂으면 켜집니다.)');
  }
});
