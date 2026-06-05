import { useState, useEffect, useCallback } from 'react';
import { idbGet, idbSet } from './idbCache';

// ─────────────────────────────────────────────────────────────────────────
//  공용 캐시 목록 훅 — "즉시 보여주고, 뒤에서 동기화" (stale-while-revalidate)
//  인물·견문록·앞으로의 목록들이 모두 이걸 쓴다.
//
//   - 진짜 원본은 서버(Supabase). 여기 캐시는 빠른 임시 사본일 뿐.
//   - 메모리 캐시: 같은 세션에서 패널 재오픈 시 '동기'라 번쩍임 0.
//   - IndexedDB 캐시: 새로고침에도 빠르게 복원(용량 걱정 없음).
//   - 열 때마다 서버와 조용히 동기화.
//
//  endpoint : 불러올 API 경로 (예: '/api/characters')
//  cacheKey : IndexedDB/메모리 캐시 키 (예: 'characters')
//  itemsKey : 응답 JSON에서 목록이 담긴 칸 이름 (예: 'characters' | 'lore')
// ─────────────────────────────────────────────────────────────────────────

const mem: Record<string, unknown[] | undefined> = {};

export function useCachedList<T>(endpoint: string, cacheKey: string, itemsKey: string) {
  const seed = (mem[cacheKey] as T[] | undefined) ?? null;
  const [items, setItems] = useState<T[]>(seed ?? []);
  const [loading, setLoading] = useState(seed === null);
  const [dbReady, setDbReady] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const refresh = useCallback(async () => {
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
  }, [refresh, cacheKey]);

  return { items, loading, dbReady, err, refresh };
}
