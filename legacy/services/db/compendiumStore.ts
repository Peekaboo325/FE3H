
// [Fix] Updated import path to use types/index to avoid deprecated root types file
import { CompendiumEntry } from '../../types/index';
import { initDB, STORE_COMPENDIUM } from './core';

export const compendiumStore = {
  saveCompendiumEntry: async (entry: CompendiumEntry) => {
    try {
      const database = await initDB();
      const tx = database.transaction(STORE_COMPENDIUM, 'readwrite');
      tx.objectStore(STORE_COMPENDIUM).put(entry);
    } catch (e) { console.warn("[DB_COMPENDIUM] Save failed:", e); }
  },

  saveCompendiumEntries: async (entries: CompendiumEntry[]) => {
    try {
      const database = await initDB();
      const tx = database.transaction(STORE_COMPENDIUM, 'readwrite');
      const store = tx.objectStore(STORE_COMPENDIUM);
      entries.forEach(entry => store.put(entry));
    } catch (e) { console.warn("[DB_COMPENDIUM] Bulk save failed:", e); }
  },

  getCompendiumEntries: async (): Promise<CompendiumEntry[]> => {
    try {
      const database = await initDB();
      const tx = database.transaction(STORE_COMPENDIUM, 'readonly');
      return new Promise((resolve) => {
        const req = tx.objectStore(STORE_COMPENDIUM).getAll();
        req.onsuccess = () => resolve(req.result || []);
      });
    } catch { return []; }
  },

  deleteCompendiumEntry: async (id: string) => {
    try {
      const database = await initDB();
      const tx = database.transaction(STORE_COMPENDIUM, 'readwrite');
      tx.objectStore(STORE_COMPENDIUM).delete(id);
    } catch (e) { console.warn("[DB_COMPENDIUM] Delete failed:", e); }
  }
};