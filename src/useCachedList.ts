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
const fetchedAt: Record<string, number> = {}; // 마지막으로 서버에서 받아온 시각(ms). 짧은 새 안의 중복 재다운로드를 막는다.
const TTL = 5 * 60 * 1000; // 5분 — 같은 목록을 이 안에 다시 열어도 서버를 다시 치지 않는다(egress 절감의 핵심).
//  ⚠️ 인물 목록엔 base64 초상·얼굴이 실려 한 번 받는 비용이 크다 → 마운트마다 재다운로드하던 것이
//     수파베이스 egress를 폭증시킨 주범이었다. 저장·삭제는 force로 즉시 갱신하므로 내 변경은 바로 보인다.

export function useCachedList<T>(endpoint: string | null, cacheKey: string, itemsKey: string) {
  const seed = endpoint ? ((mem[cacheKey] as T[] | undefined) ?? null) : ([] as T[]);
  const [items, setItems] = useState<T[]>(seed ?? []);
  const [loading, setLoading] = useState(endpoint ? seed === null : false);
  const [dbReady, setDbReady] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  // force=true(기본): 무조건 새로 받는다 — 저장·삭제·반입 직후의 명시적 갱신.
  // force=false: 마지막 수신이 TTL 안이면 건너뛴다 — 마운트마다 같은 목록을 또 내려받지 않는다.
  const refresh = useCallback(async (force = true) => {
    if (!endpoint) {
      setItems([]);
      setLoading(false);
      return;
    }
    if (!force && fetchedAt[cacheKey] && Date.now() - fetchedAt[cacheKey] < TTL) {
      setLoading(false);
      return; // 신선한 캐시 — 서버를 치지 않는다.
    }
    try {
      const res = await fetch(endpoint);
      const data = await res.json();
      setDbReady(!!data.dbReady);
      setErr(data.error || null);
      const list: T[] = Array.isArray(data[itemsKey]) ? data[itemsKey] : [];
      mem[cacheKey] = list as unknown[];
      fetchedAt[cacheKey] = Date.now();
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
    refresh(false); // 마운트 시엔 TTL 존중 — 신선하면 재다운로드 생략.
    return () => {
      alive = false;
    };
  }, [refresh, cacheKey, endpoint]);

  return { items, loading, dbReady, err, refresh };
}
