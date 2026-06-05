
import { Period, StoryParams, CharacterProfile, ChronicleEntry, Message, CompendiumEntry, Letter } from '../types/index';
import { ChronicleField } from '../services/gemini/prompts';

export interface UISlice {
    isInitialized: boolean;
    period: Period | null;
    isDarkMode: boolean;
    systemStatus: string | null;
    inputValue: string;
    isInputFocused: boolean;
    isLoading: boolean;
    loadingText: string;
    isRecallActive: boolean;
    attachedImage: string | null;
    isSessionReset: boolean;
    
    // Modal States
    isSidebarOpen: boolean;
    isCharacterModalOpen: boolean;
    isSettingsModalOpen: boolean;
    isSystemModalOpen: boolean;
    isResetModalOpen: boolean;
    isAdvisorModalOpen: boolean;
    isGalleryModalOpen: boolean;
    
    // Settings
    storyParams: StoryParams;
    customPrompt: string;
    
    // [PR #Narrative-2.1] Modular Narrative Control
    useAtmosphereInfiltration: boolean;
    useSituationalAwareness: boolean;
    useSerendipity: boolean;

    // Actions
    setInitialized: (val: boolean) => void;
    setPeriod: (period: Period | null) => void;
    toggleDarkMode: () => void;
    setIsDarkMode: (val: boolean) => void;
    setSystemStatus: (val: string | null) => void;
    showStatus: (text: string, duration?: number) => void;
    setInputValue: (val: string) => void;
    setIsInputFocused: (val: boolean) => void;
    setLoading: (val: boolean, text?: string) => void;
    setIsRecallActive: (val: boolean) => void;
    setAttachedImage: (img: string | null) => void;
    setIsSessionReset: (val: boolean) => void;
    
    // Modal Actions
    setSidebarOpen: (val: boolean) => void;
    setCharacterModalOpen: (val: boolean) => void;
    setSettingsModalOpen: (val: boolean) => void;
    setSystemModalOpen: (val: boolean) => void;
    setResetModalOpen: (val: boolean) => void;
    setAdvisorModalOpen: (val: boolean) => void;
    setGalleryModalOpen: (val: boolean) => void;

    setStoryParams: (params: StoryParams | ((prev: StoryParams) => StoryParams)) => void;
    setCustomPrompt: (prompt: string) => void;
    
    // [PR #Narrative-2.1] Modular Actions
    setUseAtmosphereInfiltration: (val: boolean) => void;
    setUseSituationalAwareness: (val: boolean) => void;
    setUseSerendipity: (val: boolean) => void;
    
    resetUISession: () => void;
    handleSelectPeriod: (period: Period) => void;
    handleImageAttach: (file: File) => Promise<void>;
}

export interface CharacterSlice {
    characters: CharacterProfile[];
    analyzingCharId: string | null;
    processingAnalysisIds: Set<string>;
    processingActions: Record<string, 'items' | 'standard' | 'letters'>;
    editingChar: CharacterProfile | null;
    isEditMode: boolean;
    aliasesInput: string;
    setCharacters: (chars: CharacterProfile[] | ((prev: CharacterProfile[]) => CharacterProfile[])) => void;
    setAnalyzingCharId: (id: string | null) => void;
    setEditingChar: (char: CharacterProfile | null) => void;
    setIsEditMode: (val: boolean) => void;
    setAliasesInput: (val: string) => void;
    handleSaveCharacter: () => Promise<void>;
    handleDeleteCharacter: (id: string) => Promise<void>;
    handleToggleCharacterActive: (e: React.MouseEvent, id: string) => Promise<void>;
    handleMoveCharacter: (index: number, direction: 'up' | 'down') => Promise<void>;
    handleReorderCharacters: (newChars: CharacterProfile[]) => Promise<void>;
    handleUpdateCharacter: (char: CharacterProfile) => Promise<void>;
    handleAnalyzeCharacter: (char: CharacterProfile, force: boolean, section?: 'items' | 'standard') => Promise<void>;
}

export interface ChronicleSlice {
    chronicles: ChronicleEntry[];
    isChronicleMode: boolean;
    isChronicleProcessing: boolean;
    processingField: ChronicleField | 'full' | null; 
    selectionStartId: string | null;
    selectionEndId: string | null;
    viewingChronicleId: string | null;
    isChronicleModalOpen: boolean;

    setChronicles: (chronicles: ChronicleEntry[]) => void;
    setIsChronicleMode: (val: boolean) => void;
    setSelectionStartId: (id: string | null) => void;
    setSelectionEndId: (id: string | null) => void;
    setViewingChronicleId: (id: string | null) => void;
    setIsChronicleModalOpen: (val: boolean) => void;

    handleToggleSelection: (id: string) => void;
    getSelectedMessages: () => Message[];
    handleCreateChronicle: () => Promise<void>;
    handleCancelChronicle: () => void;
    handlePartialRefreshChronicle: (entry: ChronicleEntry, field: ChronicleField) => Promise<void>;
    handleDeleteChronicle: (id: string) => Promise<void>;
    handleUpdateChronicle: (entry: ChronicleEntry) => Promise<void>;
    handleToggleReference: (id: string) => Promise<void>;
}

export interface ChatSlice {
    messages: Message[];
    editingMessageId: string | null;
    editingContent: string | null;
    regeneratingMessageId: string | null;
    advisorMessages: Message[];
    advisorInput: string;
    isAdvisorLoading: boolean;
    jumpToMessageId: string | null;
    isDirectEntryMode: boolean;
    proUsageCount: number;

    setMessages: (msgs: Message[]) => void;
    setEditingMessageId: (id: string | null) => void;
    setEditingContent: (content: string | null) => void;
    setAdvisorMessages: (msgs: Message[]) => void;
    setAdvisorInput: (val: string) => void;
    setJumpToMessageId: (id: string | null) => void;
    setIsDirectEntryMode: (val: boolean) => void;
    incrementProUsage: () => void;

    handleSendMessage: () => Promise<void>;
    handleDirectEntry: (content: string) => Promise<void>;
    handleStartEdit: (msg: Message) => void;
    handleSaveEdit: (msgId: string) => Promise<void>;
    handleRegenerateResponse: (msgId: string) => Promise<void>;
    handleDeleteMessage: (msgId: string) => Promise<void>;
    handleDeleteImageOnly: (msgId: string) => Promise<void>;
    handleAskAdvisor: () => Promise<void>;
}

export interface CompendiumSlice {
    compendium: CompendiumEntry[];
    viewingCompendiumId: string | null;
    isCompendiumProcessing: boolean;
    isCreatingNewCompendium: boolean;
    isCompendiumModalOpen: boolean;

    setCompendium: (entries: CompendiumEntry[]) => void;
    setViewingCompendiumId: (id: string | null) => void;
    setIsCompendiumModalOpen: (val: boolean) => void;

    handleCreateCompendiumEntry: () => void;
    handleUpdateCompendiumEntry: (entry: CompendiumEntry) => Promise<void>;
    handleDeleteCompendiumEntry: (id: string) => Promise<void>;
    handleToggleCompendiumPin: (id: string) => Promise<void>;
    handleReorderCompendium: (newEntries: CompendiumEntry[]) => Promise<void>;
}

export interface LetterSlice {
  letters: Letter[];
  setLetters: (letters: Letter[]) => void;
  addLetter: (letter: Letter) => Promise<void>;
  updateLetter: (letter: Letter) => Promise<void>;
  deleteLetter: (id: string) => Promise<void>;
  markLetterAsRead: (id: string) => Promise<void>;
  loadLetters: () => Promise<void>;
  handleRefreshLetters: (charId: string) => Promise<void>;
}

export interface IOActions {
    handleExport: (callback?: () => void) => Promise<void>;
    handleExportText: (callback?: () => void) => void;
    handleImport: (e: React.ChangeEvent<HTMLInputElement>, callback?: () => void) => void;
    handleReset: (options: { 
        resetStory: boolean; 
        resetCharacters: boolean; 
        resetCompendium: boolean; 
        resetSettings: boolean; 
        resetLetters?: boolean 
    }, callback?: () => void) => Promise<void>;
}

export interface AppRefs {
    mainInputRef: React.RefObject<HTMLTextAreaElement>;
    scrollContainerRef: React.RefObject<HTMLDivElement>;
    promptImageInputRef: React.RefObject<HTMLInputElement>;
}

export interface AppState extends UISlice, CharacterSlice, ChronicleSlice, ChatSlice, CompendiumSlice, LetterSlice {}
