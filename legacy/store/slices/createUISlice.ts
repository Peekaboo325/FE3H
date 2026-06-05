
import { StateCreator } from 'zustand';
import { Period, StoryParams } from '../../types/index';
import { db } from '../../utils/db';
import { compressPromptImage } from '../../utils/imageUtils';
import { AppState, UISlice } from '../types';

export const createUISlice: StateCreator<AppState, [], [], UISlice> = (set, get) => ({
    isInitialized: false,
    period: null,
    isDarkMode: false,
    systemStatus: null,
    inputValue: "",
    isInputFocused: false,
    isLoading: false,
    loadingText: "",
    isRecallActive: false,
    attachedImage: null,
    isSessionReset: false,
    
    isSidebarOpen: false,
    isCharacterModalOpen: false,
    isSettingsModalOpen: false,
    isSystemModalOpen: false,
    isResetModalOpen: false,
    isAdvisorModalOpen: false,
    isGalleryModalOpen: false,
    
    storyParams: { sensuality: 1, speed: 3 },
    customPrompt: "",
    
    // [PR #Narrative-2.1] Default values (All Active)
    useAtmosphereInfiltration: true,
    useSituationalAwareness: true,
    useSerendipity: true,

    setInitialized: (val) => set({ isInitialized: val }),
    setPeriod: (period) => set({ period }),
    toggleDarkMode: () => set((state) => ({ isDarkMode: !state.isDarkMode })),
    setIsDarkMode: (val) => set({ isDarkMode: val }),
    setSystemStatus: (val) => set({ systemStatus: val }),
    showStatus: (text, duration = 3000) => {
        set({ systemStatus: text });
        setTimeout(() => {
            if (get().systemStatus === text) {
                set({ systemStatus: null });
            }
        }, duration);
    },
    setInputValue: (val) => set({ inputValue: val }),
    setIsInputFocused: (val) => set({ isInputFocused: val }),
    setLoading: (val, text = "") => set({ isLoading: val, loadingText: text }),
    setIsRecallActive: (val) => set({ isRecallActive: val }),
    setAttachedImage: (img) => set({ attachedImage: img }),
    setIsSessionReset: (val) => set({ isSessionReset: val }),
    
    setSidebarOpen: (val) => set({ isSidebarOpen: val }),
    setCharacterModalOpen: (val) => set({ isCharacterModalOpen: val }),
    setSettingsModalOpen: (val) => set({ isSettingsModalOpen: val }),
    setSystemModalOpen: (val) => set({ isSystemModalOpen: val }),
    setResetModalOpen: (val) => set({ isResetModalOpen: val }),
    setAdvisorModalOpen: (val) => set({ isAdvisorModalOpen: val }),
    setGalleryModalOpen: (val) => set({ isGalleryModalOpen: val }),
    
    setStoryParams: (params) => set((state) => ({ 
        storyParams: typeof params === 'function' ? params(state.storyParams) : params 
    })),
    setCustomPrompt: (prompt) => set({ customPrompt: prompt }),

    // [PR #Narrative-2.1] Modular Setters with DB persistence
    setUseAtmosphereInfiltration: (val) => {
        set({ useAtmosphereInfiltration: val });
        db.saveSetting('useAtmosphereInfiltration', val);
        get().showStatus(val ? "기저 침윤 프로토콜이 가동됩니다." : "장소 기반 분위기 소환이 중단되었습니다.");
    },
    setUseSituationalAwareness: (val) => {
        set({ useSituationalAwareness: val });
        db.saveSetting('useSituationalAwareness', val);
        get().showStatus(val ? "상황 인지 프로토콜이 가동됩니다." : "맥락 기반 기억 소환이 단순화되었습니다.");
    },
    setUseSerendipity: (val) => {
        set({ useSerendipity: val });
        db.saveSetting('useSerendipity', val);
        get().showStatus(val ? "세렌디피티 복선 엔진이 가동됩니다." : "돌발적인 복선 소환이 중단되었습니다.");
    },

    resetUISession: () => set({
        inputValue: "",
        attachedImage: null,
        systemStatus: null,
        isLoading: false,
        isRecallActive: false
    }),

    handleSelectPeriod: (period) => {
        set({ period });
        db.saveSetting('period', period);
        if (period === 'part1') {
            get().showStatus("제국력 1180년 거목의 달로 돌아갑니다.");
        } else if (period === 'part2') {
            get().showStatus("제국력 1185년 거목의 달로 돌아갑니다.");
        }
    },

    handleImageAttach: async (file) => {
        try {
            const compressed = await compressPromptImage(file);
            set({ attachedImage: compressed });
        } catch (e) {
            console.error(e);
            get().showStatus("기억의 조각을 다듬지 못했습니다.");
        }
    },
});
