// ─────────────────────────────────────────────────────────────────────────
//  연출 소진 대장 — 화가 진행될수록 연출가가 앞 화의 지배 이미지·닫기·인물 몸짓을 되풀이하는 문제(B안).
//
//  모델 문제가 아니다(소넷·오푸스 둘 다 같은 자리서 같은 반복). '앞 화에서 뭘 이미 썼나'를 추적해
//  다음 연출에 '이건 피하라'로 넣어줘야 어느 모델이든 다른 카드를 꺼낸다. 최근 2화 원문만 보는
//  연출가는 장거리 재발(1·2·4·5화에 걸친 손동작)을 못 잡으므로, 이야기별 대장으로 기억을 외부화한다.
//
//  값싼 Gemini Flash로 {image, close, gesture} 짧은 태그만 뽑아 settings['motifs:{storyId}']에 누적.
//  세계관·인물 미주입(§3 — 기계적 추출). 실패는 조용히 무시(본문·저장에 영향 0).
// ─────────────────────────────────────────────────────────────────────────

import { callGemini } from './gemini.mjs';
import { getClient } from './db.mjs';

const 대장키 = (storyId) => `motifs:${storyId}`;
const CAP = 8; // 최근 이만큼만 유지(그 이상은 옛것부터 밀려남)

// 완성된 한 화 본문에서 {image, close, gesture} 짧은 태그를 뽑는다.
async function extractMotifs(본문) {
  const prompt =
    '다음 [본문]에서 세 가지만 아주 짧게(각 한 구절) 뽑아 JSON으로만 답하라. 설명·해석 금지, 구절만. 해당 없으면 빈 문자열.\n' +
    '{"image":"이 화의 지배적 이미지·중심 사물이나 동작","close":"마지막 문단이 닫은 이미지 — 무엇으로 끝났나","gesture":"인물의 감정을 드러낸 특징적 몸짓(손·시선·자세 등)"}\n\n' +
    `[본문]\n${본문}`;
  const { text } = await callGemini(prompt, { temperature: 0.2, maxOutputTokens: 200, json: true, tag: '모티프' });
  if (!text) return null;
  try {
    const o = JSON.parse(text);
    const t = (s) => (typeof s === 'string' ? s.trim() : '');
    const e = { image: t(o.image), close: t(o.close), gesture: t(o.gesture) };
    return e.image || e.close || e.gesture ? e : null;
  } catch {
    return null;
  }
}

// 한 화의 모티프를 뽑아 이야기별 대장에 덧붙인다(최근 CAP개만). 재작성 시엔 덧붙어 중복될 수 있으나
//  '더 피함'은 무해(변주를 더 밀 뿐)하고 옛것부터 밀려나므로 그대로 둔다.
export async function 기록모티프(storyId, 본문) {
  const c = getClient();
  if (!c || !storyId || !본문?.trim()) return;
  try {
    const e = await extractMotifs(본문);
    if (!e) return;
    const { data } = await c.from('settings').select('value').eq('key', 대장키(storyId)).maybeSingle();
    let arr = [];
    try {
      arr = data?.value ? JSON.parse(data.value) : [];
    } catch {
      arr = [];
    }
    if (!Array.isArray(arr)) arr = [];
    arr.push(e);
    if (arr.length > CAP) arr = arr.slice(-CAP);
    await c
      .from('settings')
      .upsert({ key: 대장키(storyId), value: JSON.stringify(arr), updated_at: new Date().toISOString() }, { onConflict: 'key' });
  } catch (err) {
    console.error('[모티프] 기록 실패:', err?.message || err); // 연출·본문에 영향 없음
  }
}

// 연출 프롬프트에 넣을 '되풀이 금지' 블록 — 최근 화들이 쓴 지배이미지·닫기·몸짓을 모아 피하라고.
export async function 회피블록(storyId) {
  const c = getClient();
  if (!c || !storyId) return '';
  try {
    const { data } = await c.from('settings').select('value').eq('key', 대장키(storyId)).maybeSingle();
    let arr = [];
    try {
      arr = data?.value ? JSON.parse(data.value) : [];
    } catch {
      arr = [];
    }
    if (!Array.isArray(arr) || !arr.length) return '';
    const 요약 = arr.slice(-6); // 최근 6화치만 주입(너무 길지 않게)
    const join = (k) => [...new Set(요약.map((e) => (e && e[k]) || '').filter(Boolean))].join(' / ');
    const lines = [];
    const images = join('image');
    const closes = join('close');
    const gestures = join('gesture');
    if (images) lines.push(`- 이미 쓴 지배 이미지: ${images}`);
    if (closes) lines.push(`- 이미 쓴 닫는 이미지: ${closes}`);
    if (gestures) lines.push(`- 이미 쓴 인물 몸짓: ${gestures}`);
    if (!lines.length) return '';
    return (
      '[이미 쓴 연출 — 되풀이 금지]\n' +
      '아래는 최근 화들이 이미 쓴 것들이다. 이번 화는 이것들과 겹치지 않는 다른 이미지·다른 닫기·다른 몸짓으로 설계하라. ' +
      '특히 같은 사물로 열고 닫지 말고, 같은 몸짓을 되풀이하지 마라.\n' +
      lines.join('\n')
    );
  } catch {
    return '';
  }
}
