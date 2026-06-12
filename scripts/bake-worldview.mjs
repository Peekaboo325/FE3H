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
  `export const NAME_DICT = ${JSON.stringify(dict)};\n`;
fs.writeFileSync(path.join(libDir, 'worldview.mjs'), out, 'utf-8');

console.log(`[bake] 세계관 박제 ${SYSTEM.length.toLocaleString()}자 → lib/worldview.mjs`);

const nameOut =
  '// ⚠️ 자동 생성 파일 — 직접 손대지 마십시오.\n' +
  "// worldview/풍화설월_고유명사_사전.md 가 바뀌면 'npm run bake' 로 다시 만듭니다.\n" +
  '// { 정발 표기(한글) → 원어(영문) } — 영문명 자동 매칭용.\n' +
  `export const nameDict: Record<string, string> = ${JSON.stringify(dict, null, 2)};\n`;
fs.writeFileSync(path.resolve(process.cwd(), 'src', 'nameDict.generated.ts'), nameOut, 'utf-8');
console.log(`[bake] 고유명사 ${Object.keys(dict).length}개 → src/nameDict.generated.ts`);
