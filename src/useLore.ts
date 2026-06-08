import { useCachedList } from './useCachedList';

export type LoreSection = { subtitle: string; content: string };

export type Lore = {
  id?: number;
  story_id?: number;
  title: string;
  category?: string;
  body?: string; // 섹션의 평문 거울(주입·검색용). sections가 진짜 출처.
  sections?: LoreSection[];
  is_active?: boolean;
};

// 현재 이야기의 견문록 목록 — 공용 캐시 훅 위의 얇은 래퍼.
export function useLore(storyId: number | null) {
  const endpoint = storyId ? `/api/lore?story_id=${storyId}` : null;
  const { items, loading, dbReady, err, refresh } = useCachedList<Lore>(
    endpoint,
    `lore:${storyId}`,
    'lore',
  );
  return { entries: items, loading, dbReady, err, refresh };
}
