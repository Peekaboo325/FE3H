
import { create } from 'zustand';
import { createUISlice } from './slices/createUISlice';
import { createCharacterSlice } from './slices/createCharacterSlice';
import { createChronicleSlice } from './slices/createChronicleSlice';
import { createChatSlice } from './slices/createChatSlice';
import { createCompendiumSlice } from './slices/createCompendiumSlice';
import { createLetterSlice } from './slices/createLetterSlice';

import { AppState } from './types';

export type { AppState };

export const useAppStore = create<AppState>()((...a) => ({
    ...createUISlice(...a),
    ...createCharacterSlice(...a),
    ...createChronicleSlice(...a),
    ...createChatSlice(...a),
    ...createCompendiumSlice(...a),
    ...createLetterSlice(...a),
}));
