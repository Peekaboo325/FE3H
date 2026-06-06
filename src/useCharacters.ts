import { useCachedList } from './useCachedList';

export type Character = {
  id?: number;
  story_id?: number;
  name: string;
  english_name?: string;
  aliases?: string;
  faction?: string; // 소속
  rank?: string; // 신분 (예: 왕자 / 국왕)
  crest?: string; // 문장 (예: 블레다드의 소문장)
  title?: string;
  appearance?: string;
  personality?: string;
  combat?: string;
  notes?: string;
  life_status?: 'alive' | 'deceased' | 'unknown';
  is_active?: boolean;
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
