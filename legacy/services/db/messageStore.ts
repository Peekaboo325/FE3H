// [Fix] Updated import path to use types/index to avoid deprecated root types file
import { Message } from '../../types/index';
import { initDB, STORE_MESSAGES, serializeImageField, deserializeImageField } from './core';

export const messageStore = {
  saveMessages: async (messages: Message[]) => {
    try {
      const processedMessages = await Promise.all(messages.map(async (msg) => {
          if (msg.image && (typeof msg.image === 'string')) {
               const blobImage = await serializeImageField(msg.image);
               return { ...msg, image: blobImage };
          }
          return msg;
      }));
      const database = await initDB();
      const tx = database.transaction(STORE_MESSAGES, 'readwrite');
      const store = tx.objectStore(STORE_MESSAGES);
      store.clear();
      processedMessages.forEach(msg => store.put(msg));
    } catch (e) { console.warn("[DB_MSG] Save skipped:", e); }
  },

  getMessages: async (): Promise<Message[]> => {
    try {
      const database = await initDB();
      const tx = database.transaction(STORE_MESSAGES, 'readonly');
      return new Promise<Message[]>((resolve) => {
        const req = tx.objectStore(STORE_MESSAGES).getAll();
        req.onsuccess = () => {
            const raw = req.result;
            const hydrated = raw.map(msg => ({
                ...msg,
                image: deserializeImageField(msg.image)
            }));
            resolve(hydrated);
        };
      });
    } catch { return []; }
  }
};