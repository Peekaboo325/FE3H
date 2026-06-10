// ─────────────────────────────────────────────────────────────────────────
//  소지품 그림 명단 — '보유 그림'의 단일 출처 (legacy emoji 목록에 해당).
//
//  · 서버(items.mjs): label 목록을 프롬프트에 넣어 Gemini가 '제일 비슷한 것'을 고르게.
//  · 프론트(Characters.tsx): 물건에 박제된 key로 `/assets/illust/items/<key>.webp` 경로.
//  · 그림 파일이 아직 없어도 안전 — 화면은 빈 칸(폴백)으로 두고, 파일을 폴더에 떨구면
//    코드 수정 없이 자동으로 떠오른다(경로 = key에서 파생).
//
//  명단·파일명·생성 프롬프트의 단일 기준 = docs/에셋제작_소지품.md.
//  새 물건 그림을 추가하려면: ① docs 명단에 한 줄 ② 여기에 { key, label } 한 줄.
//  key = 파일 stem(확장자 뺀 이름, 예: letter → letter.webp). label = AI가 고를 한국어 이름.
// ─────────────────────────────────────────────────────────────────────────

export const ITEM_ICONS = [
  // 1. 문서·기록
  { key: 'letter', label: '서신' },
  { key: 'scroll', label: '두루마리' },
  { key: 'book', label: '서책' },
  { key: 'quill', label: '깃펜' },
  { key: 'inkwell', label: '잉크병' },
  // 2. 장신구·기념품
  { key: 'ring', label: '반지' },
  { key: 'pendant', label: '펜던트' },
  { key: 'hairpin', label: '머리 장식' },
  { key: 'ribbon', label: '리본' },
  { key: 'mirror', label: '손거울' },
  // 3. 생활·도구
  { key: 'candle', label: '양초' },
  { key: 'lantern', label: '등불' },
  { key: 'bottle', label: '술병' },
  { key: 'cup', label: '찻잔' },
  { key: 'needle', label: '바늘과 실' },
  { key: 'rope', label: '끈' },
  { key: 'flint', label: '부싯돌' },
  // 4. 의복·천
  { key: 'cloth', label: '천 조각' },
  { key: 'handkerchief', label: '손수건' },
  { key: 'glove', label: '장갑' },
  { key: 'boots', label: '신발' },
  { key: 'cloak', label: '망토' },
  { key: 'dress', label: '드레스' },
  { key: 'eyepatch', label: '안대' },
  { key: 'mask', label: '가면' },
  // 5. 약초·음식
  { key: 'tea', label: '찻잎' },
  { key: 'herb', label: '약초' },
  { key: 'flower', label: '꽃' },
  { key: 'feather', label: '깃털' },
  { key: 'bread', label: '빵' },
  { key: 'fruit', label: '말린 과일' },
  { key: 'vial', label: '약병' },
  // 6. 무기·군용품
  { key: 'dagger', label: '단검' },
  { key: 'sword', label: '검' },
  { key: 'bow', label: '활' },
  { key: 'arrow', label: '화살촉' },
  { key: 'shield', label: '방패' },
  { key: 'armor', label: '갑주 조각' },
  { key: 'whetstone', label: '숫돌' },
  // 7. 종교·주술물
  { key: 'holy', label: '성표' },
  { key: 'rosary', label: '묵주' },
  { key: 'prayerbook', label: '기도서' },
  { key: 'charm', label: '부적' },
  // 8. 증표·불명물
  { key: 'key', label: '열쇠' },
  { key: 'seal', label: '인장' },
  { key: 'shard', label: '파편' },
  { key: 'bundle', label: '수상한 꾸러미' },
];

// label → key 빠른 조회(서버가 AI의 선택을 키로 환원할 때).
export const ICON_BY_LABEL = new Map(ITEM_ICONS.map((i) => [i.label, i.key]));
// 유효한 key 집합(프론트·정규화 검증용).
export const ICON_KEYS = new Set(ITEM_ICONS.map((i) => i.key));
