// 본문 서술자(메인 본문) 호출 — 모델 제공자에 맞춰 클라이언트·키·사고 옵션을 고른다.
//  Opus·Sonnet = Anthropic. DeepSeek V4 Pro = 'Anthropic 호환' 엔드포인트로 같은 SDK를 그대로 재활용해 부른다
//  (https://api.deepseek.com/anthropic — 메시지 포맷·스트리밍이 Anthropic과 동일하므로 baseURL만 갈아끼우면 됨).
//  ⚠️ CLAUDE.md §3: 본문 기본은 Opus(수빈 기준선). DeepSeek은 빌더가 앱 설정에서 고르는 '실험 선택지'다 — Opus를 들어내는 게 아님.
import Anthropic from '@anthropic-ai/sdk';
import { DEEPSEEK_TUNING, DEEPSEEK_ADULT } from './worldview.mjs'; // 딥시크_보정지침.md / 성인향_딥시크가산.md → bake
import { callGemini } from './gemini.mjs'; // 교정(2차) 패스 — Flash에게 위임

const DEEPSEEK_BASE = 'https://api.deepseek.com/anthropic';
const 딥시크인가 = (model) => String(model || '').startsWith('deepseek');

// 모델 제공자에 맞는 API 키(서버 환경변수). 키 없으면 undefined → 호출부가 안내.
export function 서술자키(model) {
  return 딥시크인가(model) ? process.env.DEEPSEEK_API_KEY : process.env.ANTHROPIC_API_KEY;
}

// 본문 스트리밍용 클라이언트. DeepSeek은 baseURL만 Anthropic 호환 엔드포인트로 갈아끼운다.
export function 서술자클라이언트(model) {
  if (딥시크인가(model)) {
    return new Anthropic({ apiKey: process.env.DEEPSEEK_API_KEY, baseURL: DEEPSEEK_BASE });
  }
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
}

// 사고(thinking) 옵션 — 클로드는 adaptive + effort(앱 설정), DeepSeek은 표준 Anthropic thinking 'enabled'.
//  ⚠️ DeepSeek은 사고가 본디 상시 ON이라 앱의 effort 토글을 비활성화했다(Settings) → effort와 무관하게 고정 예산.
//     budget_tokens는 응답 max_tokens(8000) 미만. 깊이를 더/덜 원하면 이 값만 운영 중 튜닝.
export function 사고옵션(model, effort) {
  if (딥시크인가(model)) {
    return { thinking: { type: 'enabled', budget_tokens: 4096 } };
  }
  return { thinking: { type: 'adaptive' }, output_config: { effort } };
}

// ── DeepSeek 한정 델타 — 2패스로 분리(생성 / 교정) ──────────────
//  텍스트 = worldview/딥시크_보정지침.md(DEEPSEEK_TUNING) · 성인향_딥시크가산.md(DEEPSEEK_ADULT) → bake.
//  ⚠️ 절제 보정(DEEPSEEK_TUNING)을 생성과 한 패스에 섞으면, 모델이 생성 시점에 그 지침을 읽지만
//     '조일 초안'이 아직 없어 교정 지시가 공중에 뜬다(사문화·빌더 진단 2026-06-24). → 생성(1차)엔
//     수위가산만 달고, 보정은 완성된 초안을 입력으로 받는 교정(2차) 패스로 옮긴다(본문생성() 참조).
//  생성(1차) 때 다는 델타 = 성인향 수위 가산만. Opus 등은 공통 베이스만(빈 배열).
export function 생성지침(model) {
  if (!딥시크인가(model)) return [];
  return DEEPSEEK_ADULT ? [{ type: 'text', text: DEEPSEEK_ADULT }] : [];
}

// 교정(2차) 패스 역할문 — 보정지침(DEEPSEEK_TUNING) 뒤에 붙는다. 삭제·정리만, 새 글 생성 아님.
export const 교정역할 = {
  type: 'text',
  text:
    '[교정 작업 — 이번 호출은 새 글을 쓰는 게 아니다]\n' +
    '아래 사용자 메시지의 [초안]은 이미 완성된 한 화 본문이다. 위 절제 보정 지침으로 그 초안을 한 번 더 조여라. ' +
    '지침에 걸리는 해석 코다·중복 문단·과잉 수식을 삭제하고 다듬는 것이 전부다 — 새 사건·인물·장면·설정을 지어내거나 분량을 늘리지 않는다. ' +
    '회차 머리글(## 제N화 · 제목 / ### 날짜)과 사건·대사의 사실관계는 그대로 보존한다. ' +
    '교정 과정·설명은 출력하지 말고, 교정된 최종 원고만 낸다.',
};

// ── 출력 양식 가드(모델 무관) — 시스템 '맨 끝'에 둬 recency가 양식 편에 서게 한다 ──────────
//  수위가산 등 강한 '장면 몰입' 지시가 맨 끝에 오면, 모델이 몰입해 회차 머리글(## 제N화·제목 / ### 날짜)을
//  흘리는 일이 생긴다('수위 장면에서만 양식 누락' 버그). 그 뒤에 한 번 더 못박아 막는다.
//  ⚠️ 생성 패스의 system 맨 끝에 둔다(본문생성() 내부: system: [...system, ...생성지침(model), 양식가드]).
export const 양식가드 = {
  type: 'text',
  text:
    '[출력 양식 — 어떤 장면이든 예외 없음]\n' +
    '수위·격정 장면이라도 회차 머리글을 먼저 쓰고 본문을 시작한다 — 첫 줄 "## 제N화 · 제목", 다음 줄 "### 제국력 [연도] [달 이름]". ' +
    '장면 몰입을 이유로 머리글·날짜줄·출력 형식을 생략하지 않는다.',
};

// 직전 화 머리글의 날짜 줄("### 제국력 …")을 찾아 돌려준다 — 머리글 보강 시 날짜 승계용.
export function 직전화날짜(messages) {
  for (let i = (messages?.length || 0) - 1; i >= 0; i--) {
    if (messages[i]?.role === 'assistant') {
      const m = String(messages[i].content || '').match(/^###[^\n]*/m);
      return m ? m[0].trim() : '';
    }
  }
  return '';
}

// 머리글 게이트 — 스트림 첫머리에서 회차 머리글 누락(수위 장면에서 잦음)을 결정론적으로 보강한다.
//  모델 출력이 '#'(머리글)로 시작하면 그대로, 본문(산문)으로 시작하면 "## 제N화[\n### 날짜]"를 앞에 끼운다.
//  양식가드(프롬프트)로도 못 막은 ~30%의 마지막 안전장치. 모델 무관·API 변경 없음.
//  write = res.write(클라 즉시 전달), 값() = DB 저장용 최종 누적본.
export function 머리글게이트(화수, 직전날짜, write) {
  let 본문 = '';
  let 판정 = false;
  let 선행 = '';
  const flush = () => {
    판정 = true;
    const 시작 = 선행.replace(/^\s+/, '');
    if (시작 && !시작.startsWith('#')) {
      const 보강 = `## 제${화수}화` + (직전날짜 ? `\n${직전날짜}` : '') + '\n\n';
      본문 += 보강;
      write(보강);
    }
    본문 += 선행;
    write(선행);
    선행 = '';
  };
  return {
    먹임(delta) {
      if (판정) {
        본문 += delta;
        write(delta);
        return;
      }
      선행 += delta;
      if (선행.replace(/^\s+/, '')) flush(); // 첫 비공백 문자가 들어오면 즉시 판정
    },
    닫기() {
      if (!판정) flush();
    },
    값: () => 본문,
  };
}

// 비용 실측 한 줄 — 콘솔에 토큰 내역(캐시 적중률 = cr / (in+cw+cr)). in은 '캐시 안 된 나머지'만.
//  단계 = '생성'/'교정'(DeepSeek 2패스) 또는 ''(단일 패스).
function 비용로그(tag, 화수, 단계, u) {
  if (!u) return;
  console.log(
    `[비용] ${tag} 화${화수}${단계 ? ' ' + 단계 : ''} ` +
      `in:${u.input_tokens ?? '-'} cw:${u.cache_creation_input_tokens ?? '-'} cr:${u.cache_read_input_tokens ?? '-'} out:${u.output_tokens ?? '-'}`,
  );
}

// 한 호출을 끝까지 받아 텍스트로 — 스트림으로 받되 res엔 안 보낸다(2패스의 1차=초안 버퍼용).
async function 호출버퍼(client, opts) {
  let text = '';
  const stream = client.messages.stream(opts);
  stream.on('text', (d) => {
    text += d;
  });
  const fin = await stream.finalMessage();
  return { text, usage: fin?.usage };
}

// 본문 한 편을 생성해 게이트로 흘린다. DeepSeek = 2패스(생성→교정), 그 외(Opus/Sonnet) = 1패스.
//  왜 2패스인가: '초안을 쓴 뒤 조인다'는 절제 보정은 생성과 같은 패스에선 조일 초안이 없어 사문화된다.
//    → 1차(DeepSeek)에서 본문을 만들고, 2차(Flash)에서 보정지침+교정역할+초안을 단일 프롬프트로 Flash에게 넘겨 빠르게 정리한다.
//  교정 패스를 Flash에 위임하는 이유: 삭제·정리는 창작이 아니라 기계적 편집 → Flash로 충분하고 속도가 2~3배 빠름.
//  ⚠️ 게이트(머리글 보강)는 호출부가 만들어 넘기고, 닫기·값()도 호출부 몫(여기선 .먹임만 한다).
//    교정(2차)은 Flash 비스트리밍 → 결과가 한 덩어리로 게이트에 들어간다(스트리밍 없음).
export async function 본문생성({ client, model, effort, system, messages, 게이트, tag = 'story', 화수 = 0 }) {
  if (딥시크인가(model)) {
    // 1차 — 생성(절제 보정 제외, 수위가산+양식가드 포함). res엔 안 보냄(버퍼).
    const 초안 = await 호출버퍼(client, {
      model,
      max_tokens: 8000,
      ...사고옵션(model, effort),
      system: [...system, ...생성지침(model), 양식가드],
      messages,
    });
    비용로그(tag, 화수, '생성', 초안.usage);
    if (!초안.text.trim()) throw new Error('1차 생성이 비어 교정할 초안이 없습니다.');
    // 2차 — 교정: Flash에게 위임(보정지침+교정역할+초안을 단일 프롬프트로 합쳐 전달).
    //  세계관·인물·대화 이력은 넣지 않음(CLAUDE.md §3 — 교정에 필요한 것만).
    const 교정프롬프트 =
      (DEEPSEEK_TUNING ? DEEPSEEK_TUNING + '\n\n' : '') +
      교정역할.text +
      '\n\n[초안]\n' +
      초안.text;
    const { text: 교정본, error: 교정오류 } = await callGemini(교정프롬프트, {
      maxOutputTokens: 8192,
      temperature: 0.2,
      thinkingBudget: 0, // 교정은 창작 아님 → thinking 끄고 속도 우선
      tag: `${tag}-교정`,
    });
    if (교정오류 || !교정본?.trim()) throw new Error(`Flash 교정 실패: ${교정오류 || '빈 응답'}`);
    게이트.먹임(교정본);
    console.log(`[비용] ${tag} 화${화수} 교정(Flash) — in/out 별도 과금(Gemini)`);
    return;
  }
  // 그 외(Opus/Sonnet) — 1패스(기존과 동일, 보정지침 미적용).
  const stream = client.messages.stream({
    model,
    max_tokens: 8000,
    ...사고옵션(model, effort),
    system: [...system, 양식가드],
    messages,
  });
  stream.on('text', (d) => 게이트.먹임(d));
  const fin = await stream.finalMessage();
  비용로그(tag, 화수, '', fin?.usage);
}
