
import { AppState } from './types';

// 1. UI Selectors
export const selectIsInitialized = (state: AppState) => state.isInitialized;
export const selectPeriod = (state: AppState) => state.period;
export const selectIsDarkMode = (state: AppState) => state.isDarkMode;
export const selectSystemStatus = (state: AppState) => state.systemStatus;
export const selectIsLoading = (state: AppState) => state.isLoading;
export const selectIsRecallActive = (state: AppState) => state.isRecallActive;
export const selectAttachedImage = (state: AppState) => state.attachedImage;
export const selectInputValue = (state: AppState) => state.inputValue;
export const selectIsInputFocused = (state: AppState) => state.isInputFocused;

// Modal Selectors
export const selectIsSidebarOpen = (state: AppState) => state.isSidebarOpen;
export const selectIsCharacterModalOpen = (state: AppState) => state.isCharacterModalOpen;
export const selectIsSettingsModalOpen = (state: AppState) => state.isSettingsModalOpen;
export const selectIsSystemModalOpen = (state: AppState) => state.isSystemModalOpen;
export const selectIsResetModalOpen = (state: AppState) => state.isResetModalOpen;
export const selectIsAdvisorModalOpen = (state: AppState) => state.isAdvisorModalOpen;
export const selectIsGalleryModalOpen = (state: AppState) => state.isGalleryModalOpen;
export const selectIsChronicleModalOpen = (state: AppState) => state.isChronicleModalOpen;

// 2. Chat Selectors
export const selectVisibleMessages = (state: AppState) => 
    state.messages.filter(m => !m.isHidden);

export const selectChatMeta = (state: AppState) => ({
    editingMessageId: state.editingMessageId,
    editingContent: state.editingContent,
    regeneratingMessageId: state.regeneratingMessageId,
    jumpToMessageId: state.jumpToMessageId
});

export const selectIsChronicleMode = (state: AppState) => state.isChronicleMode;

export const selectChronicleSelection = (state: AppState) => ({
    isChronicleMode: state.isChronicleMode,
    selectionStartId: state.selectionStartId,
    selectionEndId: state.selectionEndId
});

// 3. Unit Selectors
export const selectActiveCharacters = (state: AppState) => 
    state.characters.filter(c => c.isActive);

export const selectAllCharacters = (state: AppState) => state.characters;

export const selectAnalyzingCharId = (state: AppState) => state.analyzingCharId;

// 4. Chronicle Selectors
export const selectAllChronicles = (state: AppState) => state.chronicles;
export const selectViewingChronicleId = (state: AppState) => state.viewingChronicleId;

// 5. Advisor Selectors
export const selectAdvisorState = (state: AppState) => ({
    messages: state.advisorMessages,
    input: state.advisorInput,
    isLoading: state.isAdvisorLoading
});

// 6. Compendium Selectors
export const selectCompendium = (state: AppState) => state.compendium;
export const selectViewingCompendiumId = (state: AppState) => state.viewingCompendiumId;
export const selectIsCompendiumModalOpen = (state: AppState) => state.isCompendiumModalOpen;
