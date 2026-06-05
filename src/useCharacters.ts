import { useState, useEffect, useCallback } from 'react';
import { idbGet, idbSet } from './idbCache';

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

// ─────────────────────────────────────────────────────────────────────────
//  인물 목록 캐시 훅 — "즉시 보여주고, 뒤에서 동기화" (stale-while-revalidate)
//
//   - 진짜 원본은 Supabase. 여기 캐시는 빠른 임시 사본일 뿐.
//   - 메모리 캐시(memCache): 같은 세션에서 패널 재오픈 시 '동기'라 번쩍임 0.
//   - IndexedDB 캐시: 페이지 새로고침에도 빠르게 복원(용량 걱정 없음).
//   - 열 때마다 서버와 조용히 동기화 → 원본이 최신이면 갱신.
// ─────────────────────────────────────────────────────────────────────────

const CACHE_KEY = 'characters';

let memCache: Character[] | null = null;

export function useCharacters() {
  const [chars, setChars] = useState<Character[]>(memCache ?? []);
  // 보여줄 캐시가 하나도 없을 때만 '불러오는 중'을 띄운다.
  const [loading, setLoading] = useState(memCache === null);
  const [dbReady, setDbReady] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch('/api/characters');
      const data = await res.json();
      setDbReady(!!data.dbReady);
      setErr(data.error || null);
      const list: Character[] = Array.isArray(data.characters) ? data.characters : [];
      memCache = list;
      setChars(list);
      idbSet(CACHE_KEY, list).catch(() => {}); // 캐시 갱신(실패해도 무시)
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let alive = true;

    // 1) 세션 메모리 캐시가 없으면(=새로고침 직후) IndexedDB에서 즉시 사본을 꺼내 표시.
    if (memCache === null) {
      idbGet<Character[]>(CACHE_KEY)
        .then((cached) => {
          // 서버 응답이 먼저 와서 memCache가 채워졌으면 덮어쓰지 않는다(최신 우선).
          if (alive && cached && memCache === null) {
            memCache = cached;
            setChars(cached);
            setLoading(false);
          }
        })
        .catch(() => {});
    }

    // 2) 그리고 늘 서버와 동기화 — 원본은 Supabase.
    refresh();

    return () => {
      alive = false;
    };
  }, [refresh]);

  return { chars, loading, dbReady, err, refresh };
}
