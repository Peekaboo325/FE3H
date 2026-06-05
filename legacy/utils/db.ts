
import { 
    initDB, 
    clearStore, 
    STORE_MESSAGES, 
    STORE_CHARACTERS, 
    STORE_CHRONICLES, 
    STORE_MEMORIES,
    STORE_COMPENDIUM,
    STORE_LETTERS
} from '../services/db/core';
import { messageStore } from '../services/db/messageStore';
import { characterStore } from '../services/db/characterStore';
import { chronicleStore } from '../services/db/chronicleStore';
import { memoryStore } from '../services/db/memoryStore';
import { settingStore } from '../services/db/settingStore';
import { compendiumStore } from '../services/db/compendiumStore';
import { letterStore } from '../services/db/letterStore';

export { initDB };

export const db = {
    initDB,
    clearStore,
    
    ...messageStore,
    ...characterStore,
    ...chronicleStore,
    ...memoryStore,
    ...settingStore,
    ...compendiumStore,
    ...letterStore,
    
    STORE_MESSAGES,
    STORE_CHARACTERS,
    STORE_CHRONICLES,
    STORE_MEMORIES,
    STORE_COMPENDIUM,
    STORE_LETTERS
};
