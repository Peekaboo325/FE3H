
import { Letter } from '../../types/index';
import { initDB, STORE_LETTERS } from './core';

export const letterStore = {
  saveLetters: async (letters: Letter[]) => {
    try {
      const database = await initDB();
      const tx = database.transaction(STORE_LETTERS, 'readwrite');
      const store = tx.objectStore(STORE_LETTERS);
      // We don't clear all letters here because they are permanent records.
      // We use put to update or add.
      for (const letter of letters) {
        store.put(letter);
      }
      return new Promise<void>((resolve) => {
        tx.oncomplete = () => resolve();
      });
    } catch (e) {
      console.warn("[DB_LETTER] Save failed:", e);
    }
  },

  getAllLetters: async (): Promise<Letter[]> => {
    try {
      const database = await initDB();
      const tx = database.transaction(STORE_LETTERS, 'readonly');
      const store = tx.objectStore(STORE_LETTERS);
      return new Promise<Letter[]>((resolve) => {
        const req = store.getAll();
        req.onsuccess = () => resolve(req.result || []);
      });
    } catch {
      return [];
    }
  },

  deleteLetter: async (id: string) => {
    try {
      const database = await initDB();
      const tx = database.transaction(STORE_LETTERS, 'readwrite');
      tx.objectStore(STORE_LETTERS).delete(id);
      return new Promise<void>((resolve) => {
        tx.oncomplete = () => resolve();
      });
    } catch (e) {
      console.warn("[DB_LETTER] Delete failed:", e);
    }
  },

  getLettersByUnit: async (unitId: string): Promise<Letter[]> => {
    try {
      const database = await initDB();
      const tx = database.transaction(STORE_LETTERS, 'readonly');
      const store = tx.objectStore(STORE_LETTERS);
      const senderIndex = store.index('senderId');
      const receiverIndex = store.index('receiverId');

      const sentPromise = new Promise<Letter[]>((resolve) => {
        const req = senderIndex.getAll(unitId);
        req.onsuccess = () => resolve(req.result || []);
      });

      const receivedPromise = new Promise<Letter[]>((resolve) => {
        const req = receiverIndex.getAll(unitId);
        req.onsuccess = () => resolve(req.result || []);
      });

      const [sent, received] = await Promise.all([sentPromise, receivedPromise]);
      
      // Combine and remove duplicates (though a letter shouldn't be both sent and received by same unit per rules)
      const combined = [...sent, ...received];
      const unique = Array.from(new Map(combined.map(l => [l.id, l])).values());
      
      return unique;
    } catch {
      return [];
    }
  },

  markAsRead: async (id: string) => {
    try {
      const database = await initDB();
      const tx = database.transaction(STORE_LETTERS, 'readwrite');
      const store = tx.objectStore(STORE_LETTERS);
      const req = store.get(id);
      req.onsuccess = () => {
        const letter = req.result as Letter;
        if (letter) {
          letter.isSealed = false;
          store.put(letter);
        }
      };
      return new Promise<void>((resolve) => {
        tx.oncomplete = () => resolve();
      });
    } catch (e) {
      console.warn("[DB_LETTER] Mark as read failed:", e);
    }
  }
};
