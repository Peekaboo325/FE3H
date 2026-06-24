// ─────────────────────────────────────────────────────────────────────────
//  세계관 굽기(bake) — worldview/ 의 '박제 4종'을 하나의 코드 모듈로 구워낸다.
//
//  왜: Vercel 서버리스 함수는 배포 환경에서 파일을 직접 읽기가 까다롭다.
//  그래서 빌드 시점에 박제 문서를 lib/worldview.mjs 라는 '코드'로 바꿔 넣는다.
//  그러면 로컬 서버와 Vercel 함수가 똑같은 한 곳(lib/worldview.mjs)에서
//  세계관을 가져온다 — 단일 출처.
//
//  실행: npm run bake   (dev·build 시 자동 실행됨)
// ─────────────────────────────────────────────────────────────────────────

import fs from 'node:fs';
import path from 'node:path';

// '박제 4종'만 굽는다 (원작 정사 + 작법 규칙).
// 인물 노트·연재 설정 같은 '커스텀' 층은 나중에 DB에서 선택 주입할 자리.
const 박제문서 = [
  '풍화설월_세계관_규약.md',
  '풍화설월_집필_지침.md',
  '성인향_묘사_지침.md',
  '풍화설월_고유명사_사전.md',
];

const 머리말 =
  "당신은 '파이어 엠블렘 풍화설월' 세계를 무대로 한 인터랙티브 픽션의 서술자다. " +
  '아래 문서들은 이 세계의 표기·용어·작법의 단일 출처다. ' +
  '유저의 입력에 이어, 한국어 본문으로 이야기를 이어간다. ' +
  '안내 멘트나 사고 과정 노출 없이, 작가로서의 본문이나 인물로서의 대사만 출력한다.';

const srcDir = path.resolve(process.cwd(), 'worldview');
const 조각 = [];
for (const 파일 of 박제문서) {
  try {
    조각.push(fs.readFileSync(path.join(srcDir, 파일), 'utf-8').trim());
  } catch {
    console.warn(`[bake] 세계관 문서를 못 찾음: ${파일} (건너뜀)`);
  }
}

const SYSTEM = `${머리말}\n\n${조각.join('\n\n---\n\n')}`;

// ─── DeepSeek 서술자 한정 본문 보정(교정 패스용) ─────────────────────────
//  SYSTEM(박제 4종 = 모든 모델 공통)과 별개. DeepSeek '교정' 버튼에서 쓰는 절제 지침(lib/llm.mjs 교정역할).
//  빌더는 worldview/딥시크_보정지침.md 만 고치고 'npm run bake' 하면 된다.
let DEEPSEEK_TUNING = '';
try {
  DEEPSEEK_TUNING = fs.readFileSync(path.join(srcDir, '딥시크_보정지침.md'), 'utf-8').trim();
} catch {
  console.warn('[bake] 딥시크_보정지침.md 못 찾음 (DeepSeek 보정 건너뜀)');
}

// ─── DeepSeek 서술자 한정 본문 작법(생성 패스용) — '감각 먼저' 순서 원칙(설명충 완화) ───
//  생성 단계에 가볍게 덧대 처음부터 덜 설명하게 한다(lib/llm.mjs 생성지침). 교정(보정지침)과 짝.
let DEEPSEEK_CRAFT = '';
try {
  DEEPSEEK_CRAFT = fs.readFileSync(path.join(srcDir, '딥시크_생성지침.md'), 'utf-8').trim();
} catch {
  console.warn('[bake] 딥시크_생성지침.md 못 찾음 (DeepSeek 작법 건너뜀)');
}

// ─── DeepSeek 서술자 한정 '성인향 수위 가산'(한 단계 위) — 베이스 성인향 지침 위에 얹음 ───
//  worldview/성인향_딥시크가산.md(빌더가 직접 고침) → DEEPSEEK_ADULT. DeepSeek일 때만 덧댐(Opus 등 불변).
let DEEPSEEK_ADULT = '';
try {
  DEEPSEEK_ADULT = fs.readFileSync(path.join(srcDir, '성인향_딥시크가산.md'), 'utf-8').trim();
} catch {
  console.warn('[bake] 성인향_딥시크가산.md 못 찾음 (DeepSeek 수위 가산 건너뜀)');
}

// ─── 고유명사 사전 → {정발 표기(한글) → 원어(영문)} 맵 (영문명 자동 매칭용) ───
const dict = {};
try {
  const md = fs.readFileSync(path.join(srcDir, '풍화설월_고유명사_사전.md'), 'utf-8');
  for (const line of md.split('\n')) {
    const t = line.trim();
    if (!t.startsWith('|')) continue;
    const cells = t.split('|').slice(1, -1).map((c) => c.trim());
    if (cells.length < 2) continue;
    const [kr, en] = cells;
    if (!kr || !en) continue; // 빈 칸(원어 미상 등) 제외
    if (kr === '정발 표기' || en === '원어') continue; // 헤더 행
    if (/^:?-+:?$/.test(kr) || /^:?-+:?$/.test(en)) continue; // 구분선 행
    dict[kr] = en;
  }
} catch {
  console.warn('[bake] 고유명사 사전을 못 찾음 (이름 맵 건너뜀)');
}

const libDir = path.resolve(process.cwd(), 'lib');
fs.mkdirSync(libDir, { recursive: true });
const out =
  '// ⚠️ 자동 생성 파일 — 직접 손대지 마십시오.\n' +
  "// worldview/ 의 박제 문서가 바뀌면 'npm run bake' 로 다시 만듭니다.\n" +
  `export const SYSTEM = ${JSON.stringify(SYSTEM)};\n` +
  '// 정발 표기 목록(한글 키만) — 임무(quests) 보상 풍미용. SYSTEM과 달리 가벼운 명단이다.\n' +
  `export const NAMES = ${JSON.stringify(Object.keys(dict))};\n` +
  '// { 한글 → 영문 } — 서신(letters) 영문 서명 폴백용(명부 미등록 인연도 사전 표기로 서명).\n' +
  `export const NAME_DICT = ${JSON.stringify(dict)};\n` +
  '// DeepSeek 한정 본문 보정(교정 패스) — lib/llm.mjs 교정역할과 함께 \'교정\' 버튼 호출 system에 들어감.\n' +
  `export const DEEPSEEK_TUNING = ${JSON.stringify(DEEPSEEK_TUNING)};\n` +
  '// DeepSeek 한정 본문 작법(생성 패스) — \'감각 먼저\' 순서 원칙. 생성지침()이 DeepSeek 생성 system에 가볍게 덧댐.\n' +
  `export const DEEPSEEK_CRAFT = ${JSON.stringify(DEEPSEEK_CRAFT)};\n` +
  '// DeepSeek 한정 성인향 수위 가산(한 단계 위) — 베이스 성인향 지침 위에 얹음. 생성지침()이 DeepSeek일 때 덧댐.\n' +
  `export const DEEPSEEK_ADULT = ${JSON.stringify(DEEPSEEK_ADULT)};\n`;
fs.writeFileSync(path.join(libDir, 'worldview.mjs'), out, 'utf-8');

console.log(`[bake] 세계관 박제 ${SYSTEM.length.toLocaleString()}자 → lib/worldview.mjs`);
if (DEEPSEEK_TUNING) console.log(`[bake] DeepSeek 보정(교정) ${DEEPSEEK_TUNING.length.toLocaleString()}자 → DEEPSEEK_TUNING`);
if (DEEPSEEK_CRAFT) console.log(`[bake] DeepSeek 작법(생성) ${DEEPSEEK_CRAFT.length.toLocaleString()}자 → DEEPSEEK_CRAFT`);
if (DEEPSEEK_ADULT) console.log(`[bake] DeepSeek 수위가산 ${DEEPSEEK_ADULT.length.toLocaleString()}자 → DEEPSEEK_ADULT`);

const nameOut =
  '// ⚠️ 자동 생성 파일 — 직접 손대지 마십시오.\n' +
  "// worldview/풍화설월_고유명사_사전.md 가 바뀌면 'npm run bake' 로 다시 만듭니다.\n" +
  '// { 정발 표기(한글) → 원어(영문) } — 영문명 자동 매칭용.\n' +
  `export const nameDict: Record<string, string> = ${JSON.stringify(dict, null, 2)};\n`;
fs.writeFileSync(path.resolve(process.cwd(), 'src', 'nameDict.generated.ts'), nameOut, 'utf-8');
console.log(`[bake] 고유명사 ${Object.keys(dict).length}개 → src/nameDict.generated.ts`);
