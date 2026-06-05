import { useCachedList } from './useCachedList';

export type Character = {
  id?: number;
  name: string;
  english_name?: string;
  aliases?: string;
  faction?: string;
  title?: string;
  appearance?: string;
  personality?: string;
  combat?: string;
  notes?: string;
  life_status?: 'alive' | 'deceased' | 'unknown';
  is_active?: boolean;
  thumbnail?: string;
};

// 인물 목록 — 공용 캐시 훅 위의 얇은 래퍼.
export function useCharacters() {
  const { items, loading, dbReady, err, refresh } = useCachedList<Character>(
    '/api/characters',
    'characters',
    'characters',
  );
  return { chars: items, loading, dbReady, err, refresh };
}
