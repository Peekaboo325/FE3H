// ─────────────────────────────────────────────────────────────────────────
//  아주 작은 IndexedDB 키-값 보관함 — 캐시 전용.
//
//  왜 IndexedDB: localStorage의 약점(약 5MB 용량, 동기 블로킹)을 피하려고.
//  여기 담는 건 '빠른 임시 사본(캐시)'일 뿐, 진짜 원본은 Supabase다.
//  외부 라이브러리 없이 필요한 get/set만 얇게 감쌌다.
// ─────────────────────────────────────────────────────────────────────────

const DB_NAME = 'fe3h';
const STORE = 'cache';

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function idbGet<T>(key: string): Promise<T | undefined> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).get(key);
    req.onsuccess = () => resolve(req.result as T | undefined);
    req.onerror = () => reject(req.error);
  });
}

export async function idbSet(key: string, val: unknown): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(val, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
