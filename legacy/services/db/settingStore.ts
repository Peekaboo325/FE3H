import { initDB, STORE_SETTINGS } from './core';

export const settingStore = {
  saveSetting: async (key: string, value: any) => {
    try {
      const database = await initDB();
      const tx = database.transaction(STORE_SETTINGS, 'readwrite');
      tx.objectStore(STORE_SETTINGS).put({ key, value });
    } catch (e) { console.warn("[DB_SETTING] Save skipped:", e); }
  },

  getSetting: async <T>(key: string): Promise<T | null> => {
    try {
      const database = await initDB();
      const tx = database.transaction(STORE_SETTINGS, 'readonly');
      return new Promise((resolve) => {
        const req = tx.objectStore(STORE_SETTINGS).get(key);
        req.onsuccess = () => resolve(req.result ? req.result.value : null);
        req.onerror = () => resolve(null);
      });
    } catch { return null; }
  },

  deleteSetting: async (key: string) => {
      try {
          const database = await initDB();
          const tx = database.transaction(STORE_SETTINGS, 'readwrite');
          tx.objectStore(STORE_SETTINGS).delete(key);
          return new Promise<void>((resolve) => {
              tx.oncomplete = () => resolve();
          });
      } catch (e) { console.warn(`[DB_SETTING] Delete failed:`, e); }
  }
};
