import React from 'react';
import { CharacterProfile, CharacterAnalysis, AnalysisTab, AnalysisSection, Letter } from '../../types/index';
import { FodlanEmptyState } from '../SharedComponents';
import { AnalysisStats } from './AnalysisStats';
import { AnalysisCore } from './AnalysisCore';
import { AnalysisQuests } from './AnalysisQuests';
import { AnalysisItems } from './AnalysisItems';
import { AnalysisLetters } from './AnalysisLetters';

interface AnalysisViewSwitchProps {
  activeTab: AnalysisTab;
  character: CharacterProfile;
  isGlobalLoading: boolean;
  isAnalyzingStandard: boolean;
  isExploringItems: boolean;
  isRefreshingLetters: boolean;
  isManageMode: boolean;
  selectedItemIds: Set<string>;
  handleAnalyzeCharacter: (char: CharacterProfile, force: boolean, section: AnalysisSection) => void;
  handleToggleItemSelection: (id: string) => void;
  handleItemClick: (id: string) => void;
  handleUpdateCharacter: (char: CharacterProfile) => void;
  markLetterAsRead: (id: string) => void;
  updateLetter: (letter: Letter) => void;
  deleteLetter: (id: string) => void;
  letters: Letter[];
  allCharacters: CharacterProfile[];
}

export const AnalysisViewSwitch: React.FC<AnalysisViewSwitchProps> = React.memo(({
  activeTab, character, isGlobalLoading, isAnalyzingStandard, isExploringItems,
  isRefreshingLetters, isManageMode, selectedItemIds, handleAnalyzeCharacter, 
  handleToggleItemSelection, handleItemClick, handleUpdateCharacter,
  markLetterAsRead, updateLetter, deleteLetter, letters, allCharacters
}) => {
  const analysis = character.analysis;
  const hasAnalysis = !!analysis;

  // Analysis가 없고 능력/서신함 탭이 아니며 로딩 중도 아닐 때
  if (!hasAnalysis && activeTab !== 'ability' && activeTab !== 'letters' && !isGlobalLoading) {
    return (
      <FodlanEmptyState
        icon="📂"
        title="기록 부재"
        description="해당 유닛에 대한 기록 보관소의 정밀 분석 데이터가 존재하지 않습니다."
        action={
          <button onClick={() => handleAnalyzeCharacter(character, true, 'standard')} className="text-blue-500 hover:underline text-xs font-bold uppercase tracking-widest">
            분석 보고서 발급 시작
          </button>
        }
        className="h-full"
      />
    );
  }

  return (
    <>
      {activeTab === 'ability' && (
        <div className="md:hidden pb-10">
          <AnalysisStats character={character} analysis={analysis} isLoading={isAnalyzingStandard} />
        </div>
      )}

      {activeTab === 'core' && (
        <AnalysisCore analysis={analysis} isLoading={isAnalyzingStandard} />
      )}

      {activeTab === 'quests' && (
        <AnalysisQuests quests={analysis?.quests} isGlobalLoading={isAnalyzingStandard} />
      )}

      {activeTab === 'items' && (
        <AnalysisItems
          belongings={analysis?.belongings || []}
          isManageMode={isManageMode}
          selectedItemIds={selectedItemIds}
          isGlobalLoading={isGlobalLoading}
          isExploringItems={isExploringItems}
          onToggleSelect={handleToggleItemSelection}
          onItemClick={handleItemClick}
          onExplore={() => handleAnalyzeCharacter(character, true, 'items')}
          onUpdateBelongings={(newBelongings) => handleUpdateCharacter({
            ...character,
            analysis: { ...analysis!, belongings: newBelongings }
          })}
        />
      )}

      {activeTab === 'letters' && (
        <AnalysisLetters 
          character={character}
          letters={letters}
          allCharacters={allCharacters}
          isLoading={isRefreshingLetters}
          onMarkAsRead={markLetterAsRead}
          onUpdate={updateLetter}
          onDelete={deleteLetter}
        />
      )}
    </>
  );
});