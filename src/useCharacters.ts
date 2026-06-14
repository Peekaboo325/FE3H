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
