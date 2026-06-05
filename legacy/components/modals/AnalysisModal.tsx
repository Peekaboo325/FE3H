import React from 'react';
import { useAnalysisModal } from '../../hooks/useAnalysisModal';
import { AnalysisStats } from '../analysis/AnalysisStats';
import { AnalysisModalHeader } from '../analysis/AnalysisModalHeader';
import { AnalysisViewSwitch } from '../analysis/AnalysisViewSwitch';

interface AnalysisModalProps {
  onClose: () => void;
}

const AnalysisModal: React.FC<AnalysisModalProps> = () => {
  const {
      character, isGlobalLoading, isAnalyzingStandard, isExploringItems, isRefreshingLetters,
      activeTab, setActiveTab, isManageMode, setIsManageMode,
      selectedItemIds, setAnalyzingCharId, handleAnalyzeCharacter,
      handleToggleItemSelection, handleBulkDeleteItems, handleItemClick,
      handleUpdateCharacter, handleRefreshLetters, markLetterAsRead, updateLetter, deleteLetter,
      letters, characters
  } = useAnalysisModal();

  if (!character) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-0 md:p-4 font-sans text-gray-900 dark:text-gray-100" role="dialog" aria-modal="true" aria-labelledby="analysis-modal-title">
      {/* Background Overlay */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm animate-fodlan-backdrop" onClick={() => setAnalyzingCharId(null)} />
      
      {/* Modal Main Frame */}
      <article className="relative bg-white dark:bg-[#121214] w-full md:max-w-6xl h-full md:h-[90vh] border-0 md:border border-gray-200 dark:border-gray-800 shadow-2xl flex flex-col md:flex-row animate-fodlan-modal overflow-hidden md:rounded-sm">
        
        {/* Sidebar: Stats (Desktop only) - Isolated rendering */}
        <aside className="hidden md:flex w-80 border-r border-gray-100 dark:border-gray-800 bg-white dark:bg-[#0a0a0b] flex-col h-full shrink-0 overflow-y-auto custom-scrollbar z-10" aria-label="캐릭터 스탯 정보">
          <div className="p-6">
            <AnalysisStats character={character} analysis={character.analysis} isLoading={isAnalyzingStandard} />
          </div>
        </aside>

        {/* Main Control Panel Area */}
        <div className="flex-1 flex flex-col h-full bg-white dark:bg-[#121214] relative">
            <AnalysisModalHeader 
                activeTab={activeTab}
                setActiveTab={setActiveTab}
                isManageMode={isManageMode}
                setIsManageMode={setIsManageMode}
                isGlobalLoading={isGlobalLoading}
                isAnalyzingStandard={isAnalyzingStandard}
                isRefreshingLetters={isRefreshingLetters}
                selectedItemIdsSize={selectedItemIds.size}
                handleBulkDeleteItems={handleBulkDeleteItems}
                handleAnalyzeCharacter={() => handleAnalyzeCharacter(character, true, 'standard')}
                handleRefreshLetters={() => handleRefreshLetters(character.id)}
                onClose={() => setAnalyzingCharId(null)}
                hasBelongings={!!character.analysis?.belongings?.length}
            />

            {/* Content Display Engine - [PR #1] Internal Continuity */}
            <main 
                className={`flex-1 overflow-y-auto custom-scrollbar relative px-6 md:px-12 pb-6 md:pb-12 animate-fodlan-tab ${activeTab === 'core' ? 'pt-6' : 'pt-12'}`} 
                key={activeTab} 
                role="tabpanel"
            >
                <AnalysisViewSwitch 
                    activeTab={activeTab}
                    character={character}
                    isGlobalLoading={isGlobalLoading}
                    isAnalyzingStandard={isAnalyzingStandard}
                    isExploringItems={isExploringItems}
                    isRefreshingLetters={isRefreshingLetters}
                    isManageMode={isManageMode}
                    selectedItemIds={selectedItemIds}
                    handleAnalyzeCharacter={handleAnalyzeCharacter}
                    handleToggleItemSelection={handleToggleItemSelection}
                    handleItemClick={handleItemClick}
                    handleUpdateCharacter={handleUpdateCharacter}
                    markLetterAsRead={markLetterAsRead}
                    updateLetter={updateLetter}
                    deleteLetter={deleteLetter}
                    letters={letters}
                    allCharacters={characters}
                />
            </main>
        </div>
      </article>
    </div>
  );
};

export default AnalysisModal;