
import React from 'react';
import UnitModal from './modals/UnitModal';
import AnalysisModal from './modals/AnalysisModal';
import { AdvisorModal } from './modals/AdvisorModal';
import { SettingsModal } from './modals/SettingsModal';
import { SystemMenuModal, ResetConfirmModal } from './modals/SystemModals';
import { GalleryModal } from './modals/GalleryModal';
import ChronicleModal from './modals/ChronicleModal'; 
import CompendiumModal from './modals/CompendiumModal'; // 추가
import { useAppStore } from '../store/useAppStore';
import * as selectors from '../store/selectors';
import { IOActions } from '../store/types';

interface AppModalsProps {
    // Actions passed from useFodlan (mostly IO related)
    ioActions: IOActions; 
}

export const AppModals: React.FC<AppModalsProps> = ({
    ioActions
}) => {
    const isCharacterModalOpen = useAppStore(selectors.selectIsCharacterModalOpen);
    const setCharacterModalOpen = useAppStore(state => state.setCharacterModalOpen);
    
    const isSettingsModalOpen = useAppStore(selectors.selectIsSettingsModalOpen);
    const setSettingsModalOpen = useAppStore(state => state.setSettingsModalOpen);
    
    const isSystemModalOpen = useAppStore(selectors.selectIsSystemModalOpen);
    const setSystemModalOpen = useAppStore(state => state.setSystemModalOpen);
    
    const isResetModalOpen = useAppStore(selectors.selectIsResetModalOpen);
    const setResetModalOpen = useAppStore(state => state.setResetModalOpen);
    
    const isAdvisorModalOpen = useAppStore(selectors.selectIsAdvisorModalOpen);
    const setAdvisorModalOpen = useAppStore(state => state.setAdvisorModalOpen);
    
    const isGalleryModalOpen = useAppStore(selectors.selectIsGalleryModalOpen);
    const setGalleryModalOpen = useAppStore(state => state.setGalleryModalOpen);
    
    const isChronicleModalOpen = useAppStore(selectors.selectIsChronicleModalOpen);
    const setIsChronicleModalOpen = useAppStore(state => state.setIsChronicleModalOpen);

    const isCompendiumModalOpen = useAppStore(selectors.selectIsCompendiumModalOpen);
    const setIsCompendiumModalOpen = useAppStore(state => state.setIsCompendiumModalOpen);

    return (
        <>
            {isCharacterModalOpen && (
                <div className="animate-fodlan-modal fixed inset-0 z-[60]">
                    <UnitModal 
                        isOpen={isCharacterModalOpen} 
                        onClose={() => setCharacterModalOpen(false)}
                    />
                </div>
            )}

            <AnalysisModal 
                onClose={() => {/* AnalysisModal handles closing via store */}}
            />
            
            {/* [Fix] isChronicleMode was not defined; use isChronicleModalOpen prop instead */}
            {isChronicleModalOpen && (
                <div className="animate-fodlan-modal fixed inset-0 z-[60]">
                    <ChronicleModal
                        isOpen={isChronicleModalOpen}
                        onClose={() => setIsChronicleModalOpen(false)}
                    />
                </div>
            )}

            {isCompendiumModalOpen && (
                <div className="animate-fodlan-modal fixed inset-0 z-[60]">
                    <CompendiumModal
                        isOpen={isCompendiumModalOpen}
                        onClose={() => setIsCompendiumModalOpen(false)}
                    />
                </div>
            )}
            
            {isAdvisorModalOpen && (
                <div className="animate-fodlan-modal fixed inset-0 z-[60]">
                    <AdvisorModal 
                        isOpen={isAdvisorModalOpen}
                        onClose={() => setAdvisorModalOpen(false)}
                    />
                </div>
            )}

            {isGalleryModalOpen && (
                <div className="animate-fodlan-modal fixed inset-0 z-[60]">
                    <GalleryModal 
                        isOpen={isGalleryModalOpen}
                        onClose={() => setGalleryModalOpen(false)}
                    />
                </div>
            )}

            {isSettingsModalOpen && (
                <div className="animate-fodlan-modal fixed inset-0 z-[60]">
                    <SettingsModal 
                        isOpen={isSettingsModalOpen}
                        onClose={() => setSettingsModalOpen(false)}
                    />
                </div>
            )}

            {isSystemModalOpen && (
                <div className="animate-fodlan-modal fixed inset-0 z-[60]">
                    <SystemMenuModal 
                        isOpen={isSystemModalOpen}
                        onClose={() => setSystemModalOpen(false)}
                        onExport={() => ioActions.handleExport(() => setSystemModalOpen(false))}
                        onExportText={() => ioActions.handleExportText(() => setSystemModalOpen(false))}
                        onImport={(e: React.ChangeEvent<HTMLInputElement>) => ioActions.handleImport(e, () => setSystemModalOpen(false))}
                        onResetRequest={() => setResetModalOpen(true)}
                    />
                </div>
            )}

            {isResetModalOpen && (
                <div className="animate-fodlan-modal fixed inset-0 z-[70]">
                    <ResetConfirmModal 
                        isOpen={isResetModalOpen}
                        onClose={() => setResetModalOpen(false)}
                        onConfirm={(opts) => ioActions.handleReset(opts, () => { setResetModalOpen(false); setSystemModalOpen(false); })}
                    />
                </div>
            )}
        </>
    );
};