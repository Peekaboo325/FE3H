import { useState, useEffect, useCallback } from 'react';
import { idbGet, idbSet } from './idbCache';

// ─────────────────────────────────────────────────────────────────────────
//  공용 캐시 목록 훅 — "즉시 보여주고, 뒤에서 동기화" (stale-while-revalidate)
//  인물·견문록 등 이야기별 목록이 모두 이걸 쓴다.
//
//  endpoint : 불러올 API 경로(이야기별이라 story_id 포함). null이면 조회 안 함.
//  cacheKey : 캐시 키 (이야기별로 다름, 예: 'characters:3')
//  itemsKey : 응답 JSON에서 목록이 담긴 칸 이름 (예: 'characters' | 'lore')
// ─────────────────────────────────────────────────────────────────────────

const mem: Record<string, unknown[] | undefined> = {};

export function useCachedList<T>(endpoint: string | null, cacheKey: string, itemsKey: string) {
  const seed = endpoint ? ((mem[cacheKey] as T[] | undefined) ?? null) : ([] as T[]);
  const [items, setItems] = useState<T[]>(seed ?? []);
  const [loading, setLoading] = useState(endpoint ? seed === null : false);
  const [dbReady, setDbReady] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!endpoint) {
      setItems([]);
      setLoading(false);
      return;
    }
    try {
      const res = await fetch(endpoint);
      const data = await res.json();
      setDbReady(!!data.dbReady);
      setErr(data.error || null);
      const list: T[] = Array.isArray(data[itemsKey]) ? data[itemsKey] : [];
      mem[cacheKey] = list as unknown[];
      setItems(list);
      idbSet(cacheKey, list).catch(() => {});
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [endpoint, cacheKey, itemsKey]);

  useEffect(() => {
    let alive = true;
    if (!endpoint) {
      setItems([]);
      setLoading(false);
      return;
    }
    if (mem[cacheKey] == null) {
      idbGet<T[]>(cacheKey)
        .then((cached) => {
          if (alive && cached && mem[cacheKey] == null) {
            mem[cacheKey] = cached as unknown[];
            setItems(cached);
            setLoading(false);
          }
        })
        .catch(() => {});
    }
    refresh();
    return () => {
      alive = false;
    };
  }, [refresh, cacheKey, endpoint]);

  return { items, loading, dbReady, err, refresh };
}
