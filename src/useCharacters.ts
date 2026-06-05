import { useState, useEffect, useCallback } from 'react';

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
//   - 진짜 원본은 Supabase. 여기 캐시는 '빠른 임시 사본'일 뿐.
//   - 메모리 캐시(memCache): 같은 세션에서 패널을 다시 열면 번쩍임 없이 즉시 표시.
//   - localStorage 캐시: 페이지를 새로고침해도 즉시 표시(그 뒤 서버와 동기화).
//   - 열 때마다 조용히 refresh → 서버가 최신이면 갱신(원본은 늘 Supabase).
// ─────────────────────────────────────────────────────────────────────────

const LS_KEY = 'fe3h.characters.cache.v1';

function readLS(): Character[] | null {
  try {
    const s = localStorage.getItem(LS_KEY);
    return s ? (JSON.parse(s) as Character[]) : null;
  } catch {
    return null;
  }
}

function writeLS(list: Character[]) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(list));
  } catch {
    // 용량 초과 등은 무시 — 메모리 캐시가 세션 동안 커버한다.
  }
}

let memCache: Character[] | null = null;

export function useCharacters() {
  const seed = memCache ?? readLS();
  const [chars, setChars] = useState<Character[]>(seed ?? []);
  // 보여줄 캐시가 하나도 없을 때만 '불러오는 중'을 띄운다(=최초 1회).
  const [loading, setLoading] = useState(seed === null);
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
      writeLS(list);
      setChars(list);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh(); // 열 때마다 조용히 최신화 (화면은 캐시로 즉시 떠 있음)
  }, [refresh]);

  return { chars, loading, dbReady, err, refresh };
}
