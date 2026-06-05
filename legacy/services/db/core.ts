
import { assetManager } from '../system/assetManager';

export const DB_NAME = 'EpicsOfFodlanDB';
export const DB_VERSION = 7; 

export const STORE_MESSAGES = 'messages';
export const STORE_CHARACTERS = 'characters';
export const STORE_SETTINGS = 'settings';
export const STORE_CHRONICLES = 'chronicles';
export const STORE_MEMORIES = 'memories';
export const STORE_COMPENDIUM = 'compendium';
export const STORE_LETTERS = 'letters';

let activeDB: IDBDatabase | null = null;

export const initDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    if (activeDB) return resolve(activeDB);

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = (event) => reject('Database error: ' + (event.target as IDBOpenDBRequest).error);

    request.onsuccess = (event) => {
      activeDB = (event.target as IDBOpenDBRequest).result;
      activeDB.onversionchange = () => {
        if (activeDB) {
          activeDB.close();
          activeDB = null;
        }
      };
      resolve(activeDB);
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      if (!db.objectStoreNames.contains(STORE_MESSAGES)) {
        const store = db.createObjectStore(STORE_MESSAGES, { keyPath: 'id' });
        store.createIndex('timestamp', 'timestamp', { unique: false });
      }

      if (!db.objectStoreNames.contains(STORE_CHARACTERS)) {
        db.createObjectStore(STORE_CHARACTERS, { keyPath: 'id' });
      }

      if (!db.objectStoreNames.contains(STORE_SETTINGS)) {
        db.createObjectStore(STORE_SETTINGS, { keyPath: 'key' });
      }

      if (!db.objectStoreNames.contains(STORE_CHRONICLES)) {
        const store = db.createObjectStore(STORE_CHRONICLES, { keyPath: 'id' });
        store.createIndex('timestamp', 'timestamp', { unique: false });
      }

      if (!db.objectStoreNames.contains(STORE_MEMORIES)) {
        const store = db.createObjectStore(STORE_MEMORIES, { keyPath: 'id' });
        store.createIndex('tags', 'tags', { multiEntry: true, unique: false });
        store.createIndex('timestamp', 'timestamp', { unique: false });
      }

      if (!db.objectStoreNames.contains(STORE_COMPENDIUM)) {
        const store = db.createObjectStore(STORE_COMPENDIUM, { keyPath: 'id' });
        store.createIndex('timestamp', 'timestamp', { unique: false });
      }

      if (!db.objectStoreNames.contains(STORE_LETTERS)) {
        const store = db.createObjectStore(STORE_LETTERS, { keyPath: 'id' });
        store.createIndex('senderId', 'senderId', { unique: false });
        store.createIndex('receiverId', 'receiverId', { unique: false });
        store.createIndex('timestamp', 'timestamp', { unique: false });
      }
    };
  });
};

export const serializeImageField = async (img: string | Blob | undefined): Promise<Blob | string | undefined> => {
    if (!img) return undefined;
    
    // 이미 Blob 객체인 경우 그대로 반환
    if (img instanceof Blob) return img;

    if (typeof img === 'string' && (img.startsWith('blob:') || img.startsWith('data:'))) {
        try {
            const res = await fetch(img);
            if (!res.ok) throw new Error(`Fetch failed: ${res.statusText}`);
            return await res.blob();
        } catch (e) {
            console.warn("[DB_CORE] Serialization failed for URL:", img, e);
            // [X-Box Fix] 만약 URL이 깨진 상태라면 undefined를 반환하여 DB를 덮어쓰지 않도록 주의해야 함
            // 하지만 saveMessages가 clear() 후 put()을 하므로, 여기서 undefined를 반환하면 데이터가 유실됨.
            // 따라서 깨진 URL인 경우 에러를 던져서 해당 저장을 중단시키거나, 기존 데이터를 유지하는 로직이 필요함.
            throw new Error("STALE_ASSET"); 
        }
    }
    return img; 
};

export const deserializeImageField = (img: any): string | undefined => {
    if (img instanceof Blob) {
        // [Phase 2-J] Use managed URL creation
        return assetManager.createManagedUrl(img);
    }
    return img;
};

export const clearStore = async (storeName: string) => {
    try {
        const database = await initDB();
        const tx = database.transaction(storeName, 'readwrite');
        tx.objectStore(storeName).clear();
        return new Promise<void>((resolve) => {
            tx.oncomplete = () => resolve();
        });
    } catch (e) { console.warn(`[DB_CORE] Clear ${storeName} failed:`, e); }
};
