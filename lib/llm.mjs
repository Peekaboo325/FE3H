// 본문 서술자(메인 본문) 호출 — 모델 제공자에 맞춰 클라이언트·키·사고 옵션을 고른다.
//  Opus·Sonnet = Anthropic. DeepSeek V4 Pro = 'Anthropic 호환' 엔드포인트로 같은 SDK를 그대로 재활용해 부른다
//  (https://api.deepseek.com/anthropic — 메시지 포맷·스트리밍이 Anthropic과 동일하므로 baseURL만 갈아끼우면 됨).
//  ⚠️ CLAUDE.md §3: 본문 기본은 Opus(수빈 기준선). DeepSeek은 빌더가 앱 설정에서 고르는 '실험 선택지'다 — Opus를 들어내는 게 아님.
import Anthropic from '@anthropic-ai/sdk';
import { DEEPSEEK_TUNING, DEEPSEEK_ADULT } from './worldview.mjs'; // 딥시크_보정지침.md / 성인향_딥시크가산.md → bake

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

// ── DeepSeek 한정 델타 — 생성 / 교정 ──────────────
//  텍스트 = worldview/딥시크_보정지침.md(DEEPSEEK_TUNING) · 성인향_딥시크가산.md(DEEPSEEK_ADULT) → bake.
//  ⚠️ 절제 보정(DEEPSEEK_TUNING)을 생성과 한 패스에 섞으면 '조일 초안'이 없어 사문화된다(빌더 진단 2026-06-24).
//     → 생성엔 수위가산만 달고, 보정은 '교정' 버튼(유저가 누르는 별도 호출 = /api/story?polish)에서만 적용한다(본문교정() 참조).
//  생성 때 다는 델타 = 성인향 수위 가산만. Opus 등은 공통 베이스만(빈 배열).
export function 생성지침(model) {
  if (!딥시크인가(model)) return [];
  return DEEPSEEK_ADULT ? [{ type: 'text', text: DEEPSEEK_ADULT }] : [];
}

// 교정 패스 역할문 — 보정지침(DEEPSEEK_TUNING) 뒤에 붙는다. 삭제·최소수정만, 새 글 생성 절대 아님.
//  ⚠️ 교정이 재생성으로 새지 않게 '삭제 위주'로 못박는다(빌더+외부 진단 2026-06-25). 과삭제도 막아 '의심스러우면 둔다'.
export const 교정역할 = {
  type: 'text',
  text:
    '[교정 작업 — 이번 호출은 새 글을 쓰는 게 아니다. 편집만 한다.]\n' +
    '아래 [초안]은 이미 완성된 한 화 본문이다. 위 절제 보정 지침에 명백히 걸리는 구문만 찾아 지우거나 최소한으로 고친다. ' +
    '새 문장·새 묘사·새 사건·새 설정을 단 한 줄도 추가하지 않는다. 분량을 늘리지 않는다. ' +
    '지침에 걸리지 않는 멀쩡한 문장은 글자 하나도 건드리지 않고 그대로 둔다. 의심스러우면 두는 쪽을 택한다. ' +
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
//  단계 = '교정'(교정 버튼) 또는 ''(본문 생성).
function 비용로그(tag, 화수, 단계, u) {
  if (!u) return;
  console.log(
    `[비용] ${tag} 화${화수}${단계 ? ' ' + 단계 : ''} ` +
      `in:${u.input_tokens ?? '-'} cw:${u.cache_creation_input_tokens ?? '-'} cr:${u.cache_read_input_tokens ?? '-'} out:${u.output_tokens ?? '-'}`,
  );
}

// 본문 한 편을 생성해 게이트로 흘린다 — 단일 패스(보정 없음). 보정은 '교정' 버튼(본문교정)에서만.
//  DeepSeek = 생성지침(수위가산)+양식가드, Opus 등 = 양식가드만. 절제 보정(DEEPSEEK_TUNING)은 여기서 안 먹인다.
//  ⚠️ 게이트(머리글 보강)는 호출부가 만들어 넘기고, 닫기·값()도 호출부 몫(여기선 .먹임만 한다).
export async function 본문생성({ client, model, effort, system, messages, 게이트, tag = 'story', 화수 = 0 }) {
  const stream = client.messages.stream({
    model,
    max_tokens: 8000,
    ...사고옵션(model, effort),
    system: 딥시크인가(model) ? [...system, ...생성지침(model), 양식가드] : [...system, 양식가드],
    messages,
  });
  stream.on('text', (d) => 게이트.먹임(d));
  const fin = await stream.finalMessage();
  비용로그(tag, 화수, '', fin?.usage);
}

// 한 화 본문을 '교정'한다(DeepSeek) — 유저가 '교정' 버튼을 누를 때만. 삭제·최소수정만, 새 글 아님.
//  보정지침(DEEPSEEK_TUNING)+교정역할만 주고 [초안]=원본을 입력으로 — 세계관·인물·대화 이력 없음(§3, 교정에 필요한 것만).
//  write(델타)로 스트리밍하고, 누적된 교정 원고와 usage를 돌려준다(호출부가 저장).
export async function 본문교정({ client, model, draft, write }) {
  const stream = client.messages.stream({
    model,
    max_tokens: 8000,
    ...사고옵션(model),
    system: [DEEPSEEK_TUNING && { type: 'text', text: DEEPSEEK_TUNING }, 교정역할].filter(Boolean),
    messages: [{ role: 'user', content: `[초안]\n${draft}` }],
  });
  let text = '';
  stream.on('text', (d) => {
    text += d;
    write?.(d);
  });
  const fin = await stream.finalMessage();
  return { text, usage: fin?.usage };
}
