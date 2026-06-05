
import { StateCreator } from 'zustand';
// [Fix] Updated import path to use types/index to avoid deprecated root types file
import { CompendiumEntry } from '../../types/index';
import { db } from '../../utils/db';
import { generateId } from '../../utils/textUtils';
import { AppState, CompendiumSlice } from '../types';

export const createCompendiumSlice: StateCreator<AppState, [], [], CompendiumSlice> = (set, get) => ({
    compendium: [],
    viewingCompendiumId: null,
    isCompendiumModalOpen: false,
    isCompendiumProcessing: false,
    isCreatingNewCompendium: false,

    setCompendium: (compendium) => set({ compendium }),
    setViewingCompendiumId: (id) => set({ viewingCompendiumId: id, isCreatingNewCompendium: false }),
    setIsCompendiumModalOpen: (val) => set({ isCompendiumModalOpen: val }),

    handleCreateCompendiumEntry: () => {
        // 즉시 DB 저장하지 않고 '작성 중' 상태로만 전환
        set({ 
            viewingCompendiumId: 'new', // 가상의 ID 부여
            isCreatingNewCompendium: true 
        });
    },

    handleUpdateCompendiumEntry: async (entry) => {
        const isNew = get().isCreatingNewCompendium || entry.id === 'new';
        let finalEntry = { ...entry };
        
        if (isNew) {
            finalEntry.id = generateId(); // 실제 저장 시 ID 확정
            // [Phase DnD] 신규 항목은 리스트 끝에 배치
            finalEntry.order = get().compendium.length + 1;
            const updated = [...get().compendium, finalEntry];
            set({ 
                compendium: updated, 
                viewingCompendiumId: finalEntry.id,
                isCreatingNewCompendium: false
            });
        } else {
            const updated = get().compendium.map((c: CompendiumEntry) => c.id === entry.id ? entry : c);
            set({ compendium: updated });
        }
        
        await db.saveCompendiumEntry(finalEntry);
    },

    handleDeleteCompendiumEntry: async (id) => {
        const updated = get().compendium.filter((c: CompendiumEntry) => c.id !== id);
        set({ compendium: updated, viewingCompendiumId: null });
        await db.deleteCompendiumEntry(id);
    },

    handleToggleCompendiumPin: async (id) => {
        const updated = get().compendium.map((c: CompendiumEntry) => 
            c.id === id ? { ...c, isPinned: !c.isPinned } : c
        );
        set({ compendium: updated });
        const target = updated.find(c => c.id === id);
        if (target) await db.saveCompendiumEntry(target);
    },

    handleReorderCompendium: async (newEntries) => {
        // 인덱스를 기준으로 order 필드 재매핑하여 영구 보존
        const reordered = newEntries.map((entry, idx) => ({
            ...entry,
            order: idx + 1
        }));
        
        set({ compendium: reordered });
        
        // 전체 정렬 상태 동기화 (최적화를 위해 비동기로 순차 저장)
        for (const entry of reordered) {
            await db.saveCompendiumEntry(entry);
        }
    }
});