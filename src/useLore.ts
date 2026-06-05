import { useCachedList } from './useCachedList';

export type Lore = {
  id?: number;
  title: string;
  category?: string;
  body?: string;
  is_active?: boolean;
};

// 견문록(연재 고유 설정) 목록 — 공용 캐시 훅 위의 얇은 래퍼.
export function useLore() {
  const { items, loading, dbReady, err, refresh } = useCachedList<Lore>(
    '/api/lore',
    'lore',
    'lore',
  );
  return { entries: items, loading, dbReady, err, refresh };
}
