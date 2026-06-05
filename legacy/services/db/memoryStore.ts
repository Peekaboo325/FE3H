
// [Fix] Updated import path to use types/index to avoid deprecated root types file
import { MemoryEntry } from '../../types/index';
import { initDB, STORE_MEMORIES } from './core';

export const memoryStore = {
  saveMemory: async (entry: MemoryEntry) => {
    try {
      const database = await initDB();
      const tx = database.transaction(STORE_MEMORIES, 'readwrite');
      tx.objectStore(STORE_MEMORIES).put(entry);
    } catch (e) { console.warn("[DB_MEM] Save skipped:", e); }
  },

  getMemoriesByTags: async (tags: string[]): Promise<MemoryEntry[]> => {
    try {
      const database = await initDB();
      const tx = database.transaction(STORE_MEMORIES, 'readonly');
      const store = tx.objectStore(STORE_MEMORIES);
      const index = store.index('tags');
      
      const results: MemoryEntry[] = [];
      const promises = tags.map(tag => new Promise<void>((res) => {
        const req = index.getAll(tag);
        req.onsuccess = () => {
          if (req.result) results.push(...req.result);
          res();
        };
      }));
      
      await Promise.all(promises);
      const unique = Array.from(new Map(results.map(m => [m.id, m])).values());
      return unique.sort((a, b) => (b.importance * 1000 + b.timestamp) - (a.importance * 1000 + a.timestamp));
    } catch { return []; }
  },

  getAllMemories: async (): Promise<MemoryEntry[]> => {
    try {
      const database = await initDB();
      const tx = database.transaction(STORE_MEMORIES, 'readonly');
      return new Promise((resolve) => {
        const req = tx.objectStore(STORE_MEMORIES).getAll();
        req.onsuccess = () => resolve(req.result || []);
      });
    } catch { return []; }
  },

  deleteMemoriesByEpisode: async (episodeNumber: number): Promise<void> => {
    try {
      const database = await initDB();
      const tx = database.transaction(STORE_MEMORIES, 'readwrite');
      const store = tx.objectStore(STORE_MEMORIES);
      const req = store.getAll();
      
      return new Promise<void>((resolve, reject) => {
        req.onsuccess = () => {
          const memories = req.result as MemoryEntry[];
          const toDelete = memories.filter(m => m.source_episodes.includes(episodeNumber));
          
          if (toDelete.length === 0) return resolve();
          
          let deletedCount = 0;
          toDelete.forEach(m => {
            store.delete(m.id);
            deletedCount++;
            if (deletedCount === toDelete.length) resolve();
          });
        };
        req.onerror = () => reject(req.error);
      });
    } catch (e) { 
      console.warn("[DB_MEM] Delete by episode failed:", e); 
    }
  },

  // [PR #Purification] 모든 기억을 물리적으로 즉시 삭제
  clearAllMemories: async (): Promise<void> => {
    try {
      const database = await initDB();
      const tx = database.transaction(STORE_MEMORIES, 'readwrite');
      tx.objectStore(STORE_MEMORIES).clear();
      return new Promise((resolve) => {
        tx.oncomplete = () => resolve();
      });
    } catch (e) {
      console.warn("[DB_MEM] Clear all failed:", e);
    }
  }
};
