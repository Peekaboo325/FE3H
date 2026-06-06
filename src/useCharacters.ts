import { useCachedList } from './useCachedList';

// 인연(관계) 한 줄.
export type Bond = { name: string; category?: string; description?: string };

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
