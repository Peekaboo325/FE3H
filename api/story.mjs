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
import { saveTurn, touchStory, loadCharactersForInjection, loadLoreForInjection, getGuidance, getTurnContent, savePolished } from '../lib/db.mjs';
import { buildGuidanceBlock } from '../lib/guidance.mjs';
import { genConfig } from '../lib/genConfig.mjs';
import { 서술자키, 서술자클라이언트, 머리글게이트, 직전화날짜, 본문생성, 본문교정 } from '../lib/llm.mjs';
import { buildCharacterContext } from '../lib/charContext.mjs';
import { buildLoreContext } from '../lib/loreContext.mjs';
import { prepareConversation, buildSummaryBlock } from '../lib/memory.mjs';
import { runEnrich } from '../lib/enrich.mjs';
import {
  parseAnchors,
  buildAnchorContext,
  parseLoreAnchors,
  buildLoreAnchorContext,
  buildCharacterAnchorContext,
} from '../lib/anchor.mjs';

const MODEL = 'claude-opus-4-8'; // 메인 본문 = Opus 4.8 (CLAUDE.md)

export const config = { maxDuration: 300 }; // 긴 화도 60초 천장 없이 완결. 진짜 천장 = 이 값 + Fluid compute(플랜 아님): 300초 = Hobby(Fluid ON)·Pro 공통(2026-06-19 정정·DEVLOG)

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).end('POST만 받습니다.');
    return;
  }

  // 윤색(연출 콘티) 전처리 — 본문 스트리밍과 별개. 짧은 1차를 2차 콘티로 펼쳐 JSON으로 돌려준다(딥시크 경로의 실행 전 단계).
  if (req.body?.enrich) {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    const r = await runEnrich({
      storyId: req.body?.story_id ?? null,
      prompt: req.body?.prompt,
      model: req.body?.conti_model, // 연출 모델(Flash/Sonnet/Opus) — runEnrich가 허용목록으로 검증
    });
    return res.status(r.error ? 500 : 200).end(JSON.stringify(r));
  }

  // 교정(유저가 '교정' 버튼) — 한 화의 원본(turns.content)을 딥시크로 교정·스트리밍하고 turns.polished에 저장.
  //  새 함수(api 12함수 한도) 대신 story의 서브모드로 둔다(enrich와 같은 결).
  if (req.body?.polish) {
    return handlePolish(req, res);
  }

  const { model, effort } = genConfig(req.body); // 서술자 모델·사고 깊이(기본 Opus/medium). DeepSeek도 여기서 허용
  const key = 서술자키(model); // 제공자에 맞는 키(클로드=ANTHROPIC_API_KEY / DeepSeek=DEEPSEEK_API_KEY)
  if (!key) {
    res.status(400).setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.end(
      `[서고] ${model.startsWith('deepseek') ? 'DEEPSEEK_API_KEY' : 'ANTHROPIC_API_KEY'} 가 꽂히지 않았습니다.\n` +
        '환경 변수에 추가하고 다시 배포해 주세요.',
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
  const [{ messages: 대화, summary: 줄거리 }, 참고, 견문록참고, 인물참고] = await Promise.all([
    prepareConversation(storyId, messages),
    지목.length ? buildAnchorContext(storyId, 입력문, 지목) : Promise.resolve({ block: null, episodes: [] }),
    견문록지목.refs.length || 견문록지목.titles.length
      ? buildLoreAnchorContext(storyId, 견문록지목)
      : Promise.resolve({ block: null, items: [] }),
    입력문.includes('등장')
      ? buildCharacterAnchorContext(storyId, 입력문) // "이름 등장" — 비활성 인물 임시 소환
      : Promise.resolve({ block: null, chars: [] }),
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
  // 프롬프트 캐싱 — 안정 블록마다 캐시 경계(1h TTL). 최대 4개 = 세계관/문헌/지침/인물.
  //  '앞에서부터 일치'라 끝(인물)을 바꿔도 앞 블록 캐시는 안 깨진다 → 인물 토글 = 인물 칸만 재기록.
  //  순서 = '잘 안 바뀜→자주 바뀜'(세계관→문헌→지침→인물). 세계관+문헌을 '세계 사실'로 앞에 묶고,
  //  지침은 그 위 집필 지시. 가장 자주 만지는 인물이 맨 뒤라 인물 토글이 뒤를 안 깨뜨림.
  //  줄거리·화수·앵커는 매 턴 바뀌므로 경계를 두지 않는다(자연히 캐시 안 됨).
  const 캐시 = { type: 'ephemeral', ttl: '1h' };
  const system = [{ type: 'text', text: SYSTEM, cache_control: 캐시 }];
  if (설정블록) system.push({ type: 'text', text: 설정블록, cache_control: 캐시 }); // 대륙 문헌(활성)
  if (지침블록) system.push({ type: 'text', text: 지침블록, cache_control: 캐시 }); // 기록 지침
  if (인물블록) system.push({ type: 'text', text: 인물블록, cache_control: 캐시 }); // 인물(활성)
  if (줄거리블록) system.push({ type: 'text', text: 줄거리블록 }); // 대화 앞 = 최신 맥락(캐시 안 함)
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
  // 스트림이 프록시에 버퍼링·변형돼 끊기지 않게(간헐적 끊김 대비).
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('X-Accel-Buffering', 'no');

  // 실제로 되짚은 회차·문헌·소환 인물을 헤더로 — 클라가 그 화에 '확인 자취'를 남긴다(본문 전에 전송).
  const 자취 = {};
  if (참고.episodes.length) 자취.ep = 참고.episodes;
  if (견문록참고.items.length) 자취.lore = 견문록참고.items;
  if (인물참고.chars.length) 자취.char = 인물참고.chars;
  if (자취.ep || 자취.lore || 자취.char) {
    res.setHeader('x-recall', encodeURIComponent(JSON.stringify(자취)));
  }
  // 되짚으려 했으나 못 살린 것 — 조용한 실패를 없애 작가가 결과를 본다(x-recall-note).
  const 안내 = {};
  if (참고.missNums?.length) 안내.epMiss = 참고.missNums; // 아직 없는 회차
  if (참고.briefFailed) 안내.epBrief = true; // 회차는 있으나 추려내기 실패
  const 견문록의도 = 견문록지목.refs.length || 견문록지목.titles.length;
  if (견문록의도 && !견문록참고.items.length) 안내.loreMiss = true; // 지목 문헌 못 찾음
  if (인물참고.here?.length) 안내.charHere = 인물참고.here; // 이미 함께 있음
  if (인물참고.miss?.length) 안내.charMiss = 인물참고.miss; // 명부에 없는 이름
  if (안내.epMiss || 안내.epBrief || 안내.loreMiss || 안내.charHere || 안내.charMiss) {
    res.setHeader('x-recall-note', encodeURIComponent(JSON.stringify(안내)));
  }

  let 본문 = '';
  const 게이트 = 머리글게이트(화수, 직전화날짜(대화), (s) => res.write(s)); // 머리글 누락 결정론적 보강
  try {
    // 본문 생성 — 단일 패스(보정 없음). 게이트로 스트리밍·비용 로그(lib/llm.mjs). 교정은 '교정' 버튼에서만.
    await 본문생성({ client, model, effort, system, messages: 대화, 게이트, tag: 'story', 화수 });
    게이트.닫기();
    본문 = 게이트.값();
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

// ── 교정 서브모드 — 한 화 원본을 딥시크로 교정·스트리밍하고 turns.polished에 저장 ──────────
//  교정은 어떤 모델이 쓴 화든 딥시크가 한다(빌더 확정 2026-06-25). 세계관·인물 없음(§3 — 교정에 필요한 것만).
const POLISH_MODEL = 'deepseek-v4-pro';
async function handlePolish(req, res) {
  const key = 서술자키(POLISH_MODEL);
  if (!key) {
    res.status(400).setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.end('[서고] DEEPSEEK_API_KEY 가 없습니다.');
    return;
  }
  const turnId = req.body?.turn_id ? Number(req.body.turn_id) : null;
  if (!turnId) {
    res.status(400).setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.end('[서고] 잘못된 교정 요청입니다.');
    return;
  }
  const { content: 원본 } = await getTurnContent(turnId);
  if (!원본?.trim()) {
    res.status(400).setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.end('[서고] 교정할 본문이 없습니다.');
    return;
  }

  const client = 서술자클라이언트(POLISH_MODEL);
  res.status(200).setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('X-Accel-Buffering', 'no');
  try {
    const { text: 교정본 } = await 본문교정({ client, model: POLISH_MODEL, draft: 원본, write: (s) => res.write(s) });
    if (교정본.trim()) {
      const save = await savePolished(turnId, 교정본);
      if (save.error) res.write(`\n\n[서고 오류] 교정본을 기록하지 못했습니다: ${save.error}`);
    }
    res.end();
  } catch (err) {
    const 사유 = err?.message || String(err);
    console.error('[서고] 교정 오류:', 사유);
    res.write(`\n\n[서고 오류] 교정에 실패했습니다: ${사유}`);
    res.end();
  }
}
