import { useCachedList } from './useCachedList';

// 인연(관계) 한 줄.
export type Bond = {
  name: string;
  category?: string;
  description?: string;
  status?: 'alive' | 'deceased' | 'unknown';
};

// 소지품 한 점 — 탐색할 때마다 누적되는 주머니 속 물건(이름 + 단정하지 않는 한 줄 + 그림 키).
export type BelongingItem = {
  id?: string; // 소각·식별용 안정 키(서버가 발급)
  name: string;
  comment: string;
  icon?: string; // 그림 key(lib/itemIcons.mjs) — 경로는 /assets/illust/items/<icon>.webp
};

// 임무 한 건 — 인물이 스스로 세우는 계획(1인칭 독백)과 그 뒤에 남는 것(보상).
export type QuestItem = {
  type: string; // 의무·야망·교류·휴식·돌발
  name: string;
  description: string;
  reward: string;
};

// 일지 한 장 — 인물 본인이 그날의 끝에서 적는 글(1인칭·날것). 서신의 안쪽 짝.
export type JournalEntry = {
  id?: string; // 소각·식별용 안정 키(서버가 발급)
  title?: string; // (옛 항목 잔존 — 새 일지엔 제목이 없다. 일기는 표제를 달지 않으므로)
  body: string; // 일지 본문(문단은 빈 줄로). 목록은 이 첫머리로 식별
  created_at?: string; // 술회 시각(ISO)
  through?: number; // 이 일지가 덮은 마지막 회차(turn id) — 다음 일지 포인터의 근거
};

// ── 일상(日常) 시스템 — 인물의 '살아 있는 나날'(설계 docs/일상_설계.md). 일지를 엎고 대체. ──
//  자립 기둥: 연료를 '턴'이 아니라 인물 프로필·세계·관계·정사에서 가져온다(Opus 꺼져도 돈다).
//  저장은 analysis.daily 한 칸에 격리 — 보고서·약력을 안 더럽히고, 가림 판정도 자기칸(setup_at)으로(§14).

// 능력 6각 키 — 보고서 8종에서 입지(standing)·재력(wealth)을 뺀 것(재력→지갑, 입지→보고서). 라벨은 Characters.tsx와 일치.
export type AbilityKey = 'prowess' | 'magic' | 'faith' | 'intellect' | 'charm' | 'resilience';

// 능력 등급 11단계 — 원작 무기 숙련(S+ 없음). 속은 숫자, 표시만 등급(비선형 가속 문턱표로 환산 §6).
export type Grade = 'E' | 'E+' | 'D' | 'D+' | 'C' | 'C+' | 'B' | 'B+' | 'A' | 'A+' | 'S';

// 특성 한 개 — 인물에 박히는 고정 개성(효율 ±·락). 빌더 직접 세팅(AI 추측 안 거침). 인물당 3개.
//  세부 효율/락 메커니즘은 4단계(육성)에서 확정 — 0단계는 이름·대상만.
export type DailyTrait = {
  name: string; // 건조한 한자 분류어(재능·무능·둔재·경건·광신 등)
  ability?: AbilityKey; // 어느 능력에 거는 특성인가(신앙 3특례 포함)
};

export type IncomeGrade = '없음' | '하' | '중' | '상'; // 시간당 고정 수입 — 신분 기준(1:10:50, 없음=0). 빌더 직접 고름.
export type RelationTag = '친밀' | '적대'; // 관계 태그 — 점수 없이 둘. 마주침을 가르는 스위치(§8).

// 인물의 '일상' 서랍 — 단계별로 칸을 채운다(주석의 §은 설계서 절). 전체를 미리 정의해 구조가 안 흔들리게.
export type DailyState = {
  setup_at?: string; // 빌더 세팅 완료 표식 — 자기칸 가림·존재 판정(analysis 통째 판정 금지 §14)
  // §6 능력·특성 (0-C 세팅 면에서 채움)
  start_grades?: Partial<Record<AbilityKey, Grade>>; // 시작 등급(빌더 수기 1회 — 천장 C, S·A·B는 육성으로만)
  points?: Partial<Record<AbilityKey, number>>; // 육성 적립(속은 숫자 — 문턱표로 등급 환산)
  traits?: DailyTrait[]; // 특성 3개
  // §5 경제 (0-C 수입 등급 / 2단계 지갑)
  income_grade?: IncomeGrade; // 시간당 고정 수입 등급
  wallet?: number; // 지갑 — 가장 작은 단위(동화) 정수 하나, 보여줄 때만 동/은/금화로 굴림
  // §3 상태 (3단계)
  condition?: number; // 컨디션/안색 하나(가역) — 격려로 끌어올림
  ailments?: string[]; // 경미한 병·일시 상태(근육통 등 — 육성 게이트 겸함)
  // §6 육성 점유 (4단계 — 숙성형)
  training?: { course: string; until: string } | null; // 수업 중·종료 시각(점유)
  // §8 관계 / §3 서사 (0-C 태그 / 애정은 전개 반영 전용)
  relations?: Record<string, RelationTag>; // 상대 인물 id → 친밀/적대
  affection?: Record<string, string>; // 애정 단계(방향 있는 각자값 — 무심·연심·연인·혼인·파경)
  // §11 스킨 / §10 정사 / §4 정산
  skin_id?: string; // 거처 스킨(순수 치장 — 빌더 상상 보조)
  canon?: string[]; // 정사 자취(짧은 한 줄들 — 새김, 본문에서만)
  last_settled_at?: string; // 마지막 정산 시각(열 때 따라잡기 §4)
  // §12·13 펫·식물은 그 단계에서 키 추가
};

// 분석 보고서 — LLM(Gemini Flash)이 약력·맥락을 읽고 발급한다.
export type CharReport = {
  quote?: string;
  hashtags?: string[];
  stats?: Record<string, number>; // 8종: prowess·magic·faith·intellect·standing·wealth·charm·resilience
  stat_comments?: Record<string, string>;
  personality?: string; // 성격 분석
  unconscious?: string; // 무의식 분석
  reputation?: { source: string; comment: string }[]; // 평판 6종 (타인의 시선)
  generated_at?: string; // 발급 시각(ISO)
  quests?: QuestItem[]; // 임무 장부 (임무 탭 — 보고서와 따로 발급)
  quests_at?: string; // 임무 발급 시각(ISO)
  belongings?: BelongingItem[]; // 소지품 (소지품 탭 — 탐색마다 누적)
  belongings_at?: string; // 마지막 탐색 시각(ISO)
  journals?: JournalEntry[]; // 일지 (일지 탭 — 술회마다 누적, 최신이 위)
  journals_at?: string; // 마지막 술회 시각(ISO)
  journals_cursor?: number; // '여기까지 적음' 포인터(마지막으로 덮은 turn id)
  daily?: DailyState; // 일상(日常) 서랍 — 격리 칸(능력·경제·상태·관계·정사…). 단계별로 채움
};

export type Character = {
  id?: number;
  story_id?: number;
  name: string;
  english_name?: string;
  aliases?: string;
  base?: string; // 거점 (활동 근거지)
  gender?: string; // 성별 (남성/여성)
  faction?: string; // 소속
  rank?: string; // 신분 (예: 왕자 / 국왕)
  crest?: string; // 문장 (예: 블레다드의 소문장)
  title?: string;
  appearance?: string; // (구) 외양 자유서술 — 미사용, 용모 5항목으로 대체
  height?: string; // 신장
  build?: string; // 체격
  hair?: string; // 모발
  iris?: string; // 홍채
  impression?: string; // 인상
  personality?: string;
  combat?: string;
  notes?: string;
  bonds?: Bond[]; // 인연(관계) — 명부 인물과 이름으로 자동 연동
  analysis?: CharReport | null; // 분석 보고서 (보고서 탭)
  life_status?: 'alive' | 'deceased' | 'unknown';
  is_active?: boolean;
  sort_order?: number; // 목록 정렬 순서(드래그로 변경)
  thumbnail?: string; // 초상 — 인물 카드(뷰) 히어로용(전신·상반신)
  avatar?: string; // 얼굴 — 명부 목록용 둥근 썸네일(얼굴 클로즈업). 없으면 thumbnail로 대체.
};

// 현재 이야기의 인물 목록 — 공용 캐시 훅 위의 얇은 래퍼.
export function useCharacters(storyId: number | null) {
  const endpoint = storyId ? `/api/characters?story_id=${storyId}` : null;
  const { items, loading, dbReady, err, refresh } = useCachedList<Character>(
    endpoint,
    `characters:${storyId}`,
    'characters',
  );
  return { chars: items, loading, dbReady, err, refresh };
}
