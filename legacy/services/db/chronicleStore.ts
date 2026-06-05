// [Fix] Updated import path to use types/index to avoid deprecated root types file
import { ChronicleEntry } from '../../types/index';
import { initDB, STORE_CHRONICLES } from './core';

export const chronicleStore = {
  saveChronicle: async (entry: ChronicleEntry) => {
    try {
      const database = await initDB();
      const tx = database.transaction(STORE_CHRONICLES, 'readwrite');
      tx.objectStore(STORE_CHRONICLES).put(entry);
    } catch (e) { console.warn("[DB_CHRON] Save skipped:", e); }
  },

  saveChronicles: async (entries: ChronicleEntry[]) => {
    try {
      const database = await initDB();
      const tx = database.transaction(STORE_CHRONICLES, 'readwrite');
      const store = tx.objectStore(STORE_CHRONICLES);
      entries.forEach(entry => store.put(entry));
    } catch (e) { console.warn("[DB_CHRON] Bulk save skipped:", e); }
  },

  getChronicles: async (): Promise<ChronicleEntry[]> => {
    try {
      const database = await initDB();
      const tx = database.transaction(STORE_CHRONICLES, 'readonly');
      return new Promise<ChronicleEntry[]>((resolve) => {
        const req = tx.objectStore(STORE_CHRONICLES).getAll();
        req.onsuccess = () => resolve(req.result);
      });
    } catch { return []; }
  },

  deleteChronicle: async (id: string) => {
    try {
      const database = await initDB();
      const tx = database.transaction(STORE_CHRONICLES, 'readwrite');
      tx.objectStore(STORE_CHRONICLES).delete(id);
    } catch (e) { console.warn("[DB_CHRON] Delete skipped:", e); }
  }
};