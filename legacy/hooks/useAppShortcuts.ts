
import { useEffect } from 'react';
import { useAppStore } from '../store/useAppStore';
import * as selectors from '../store/selectors';

export const useAppShortcuts = () => {
    const isSidebarOpen = useAppStore(selectors.selectIsSidebarOpen);
    const isCharacterModalOpen = useAppStore(selectors.selectIsCharacterModalOpen);
    const isSettingsModalOpen = useAppStore(selectors.selectIsSettingsModalOpen);
    const isSystemModalOpen = useAppStore(selectors.selectIsSystemModalOpen);
    const isResetModalOpen = useAppStore(selectors.selectIsResetModalOpen);
    const isAdvisorModalOpen = useAppStore(selectors.selectIsAdvisorModalOpen);
    const isGalleryModalOpen = useAppStore(selectors.selectIsGalleryModalOpen);
    const isChronicleModalOpen = useAppStore(selectors.selectIsChronicleModalOpen);
    const isCompendiumModalOpen = useAppStore(selectors.selectIsCompendiumModalOpen);
    const isChronicleMode = useAppStore(selectors.selectIsChronicleMode);
    const analyzingCharId = useAppStore(selectors.selectAnalyzingCharId);

    const {
        setSidebarOpen, setCharacterModalOpen, setSettingsModalOpen, setSystemModalOpen,
        setResetModalOpen, setAdvisorModalOpen, setGalleryModalOpen,
        setIsChronicleModalOpen, setIsCompendiumModalOpen, setAnalyzingCharId,
        handleCancelChronicle
    } = useAppStore();

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                if (isResetModalOpen) { setResetModalOpen(false); return; }
                if (isSystemModalOpen) { setSystemModalOpen(false); return; }
                if (isSettingsModalOpen) { setSettingsModalOpen(false); return; }
                if (analyzingCharId) { setAnalyzingCharId(null); return; }
                if (isCharacterModalOpen) { setCharacterModalOpen(false); return; }
                if (isAdvisorModalOpen) { setAdvisorModalOpen(false); return; }
                if (isGalleryModalOpen) { setGalleryModalOpen(false); return; }
                if (isChronicleModalOpen) { setIsChronicleModalOpen(false); return; }
                if (isCompendiumModalOpen) { setIsCompendiumModalOpen(false); return; }
                if (isSidebarOpen) { setSidebarOpen(false); return; }
                if (isChronicleMode) { handleCancelChronicle(); return; }
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [
        isResetModalOpen, isSystemModalOpen, isSettingsModalOpen, isCharacterModalOpen, 
        isAdvisorModalOpen, isGalleryModalOpen, isChronicleModalOpen, isCompendiumModalOpen, isSidebarOpen, 
        isChronicleMode, analyzingCharId, handleCancelChronicle, setAnalyzingCharId, setIsCompendiumModalOpen,
        setSidebarOpen, setCharacterModalOpen, setSettingsModalOpen, setSystemModalOpen, setResetModalOpen,
        setAdvisorModalOpen, setGalleryModalOpen
    ]);
};
