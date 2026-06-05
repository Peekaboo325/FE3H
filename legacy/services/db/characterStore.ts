
// [Fix] Updated import path to use types/index to avoid deprecated root types file
import { CharacterProfile } from '../../types/index';
import { initDB, STORE_CHARACTERS, serializeImageField, deserializeImageField } from './core';

/**
 * [Purification Protocol]
 * 전임자가 남긴 'relathionship' 등 폐기된 유령 필드를 탐지하여 삭제합니다.
 * 또한 새로운 규격인 bonds 배열이 없으면 초기화합니다.
 */
const sanitizeCharacterData = (char: any): CharacterProfile => {
    const clean = { ...char };
    
    // 1. 유령 필드 소각 (relathionship, relation, connect_info, diary_entries 등)
    const ghostFields = ['relathionship', 'relation', 'connect_info', 'diary_entries'];
    ghostFields.forEach(field => {
        if (field in clean) {
            console.debug(`[Purification] Ghost field '${field}' detected in character '${clean.name}'. Deleting...`);
            delete clean[field];
        }
    });

    // 2. 신규 규격 안착
    if (!clean.bonds) clean.bonds = [];

    return clean as CharacterProfile;
};

export const characterStore = {
  saveCharacters: async (characters: CharacterProfile[]) => {
    try {
      const processedChars = await Promise.all(characters.map(async (char) => {
          let updatedChar = sanitizeCharacterData(char);
          if (updatedChar.thumbnail) {
              updatedChar.thumbnail = await serializeImageField(updatedChar.thumbnail) as any;
          }
          return updatedChar;
      }));
      const database = await initDB();
      const tx = database.transaction(STORE_CHARACTERS, 'readwrite');
      const store = tx.objectStore(STORE_CHARACTERS);
      store.clear();
      processedChars.forEach(char => store.put(char));
    } catch (e) { console.warn("[DB_CHAR] Save skipped:", e); }
  },

  getCharacters: async (): Promise<CharacterProfile[]> => {
    try {
      const database = await initDB();
      const tx = database.transaction(STORE_CHARACTERS, 'readonly');
      return new Promise<CharacterProfile[]>((resolve) => {
        const req = tx.objectStore(STORE_CHARACTERS).getAll();
        req.onsuccess = () => {
            const raw = req.result as CharacterProfile[];
            // [PR #Order-Fix] order 필드 기준으로 정렬하여 반환 (없으면 ID순 폴백 방지 위해 timestamp나 기본값 사용)
            const hydrated = raw.map(char => {
                const sanitized = sanitizeCharacterData(char);
                return {
                    ...sanitized,
                    thumbnail: deserializeImageField(sanitized.thumbnail)
                };
            }).sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
            
            resolve(hydrated);
        };
      });
    } catch { return []; }
  },

  updateCharacter: async (id: string, updates: Partial<CharacterProfile>) => {
    try {
      const database = await initDB();
      const tx = database.transaction(STORE_CHARACTERS, 'readwrite');
      const store = tx.objectStore(STORE_CHARACTERS);
      
      return new Promise<void>((resolve, reject) => {
        const getReq = store.get(id);
        getReq.onsuccess = () => {
          const char = getReq.result;
          if (!char) return resolve();
          
          const updated = { ...char, ...updates };
          const putReq = store.put(updated);
          putReq.onsuccess = () => resolve();
          putReq.onerror = () => reject(putReq.error);
        };
        getReq.onerror = () => reject(getReq.error);
      });
    } catch (e) { console.warn("[DB_CHAR] Update failed:", e); }
  },

  stripCharacterAnalysis: async () => {
      try {
          const database = await initDB();
          const tx = database.transaction(STORE_CHARACTERS, 'readwrite');
          const store = tx.objectStore(STORE_CHARACTERS);
          
          return new Promise<void>((resolve, reject) => {
              const req = store.getAll();
              req.onsuccess = () => {
                  const chars = req.result as CharacterProfile[];
                  if (chars.length === 0) return resolve();

                  let processedCount = 0;
                  chars.forEach(char => {
                      const updated = { ...sanitizeCharacterData(char), analysis: undefined };
                      store.put(updated);
                      processedCount++;
                      if (processedCount === chars.length) resolve();
                  });
              };
              req.onerror = () => reject(req.error);
          });
      } catch (e) { console.warn("[DB_CHAR] Strip analysis failed:", e); }
  }
};
