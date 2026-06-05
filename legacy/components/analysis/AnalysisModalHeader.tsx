
import React from 'react';
import { IconButton } from '../ui/IconButton';
import { RefreshButton } from '../ui/RefreshButton';
import { DeleteButton } from '../ui/DeleteButton';
import { AnalysisTab } from '../../types/index';

interface AnalysisModalHeaderProps {
  activeTab: AnalysisTab;
  setActiveTab: (tab: AnalysisTab) => void;
  isManageMode: boolean;
  setIsManageMode: (val: boolean) => void;
  isGlobalLoading: boolean;
  isAnalyzingStandard: boolean;
  selectedItemIdsSize: number;
  handleBulkDeleteItems: () => void;
  handleAnalyzeCharacter: () => void;
  handleRefreshLetters: () => void;
  isRefreshingLetters: boolean;
  onClose: () => void;
  hasBelongings: boolean;
}

export const AnalysisModalHeader: React.FC<AnalysisModalHeaderProps> = React.memo(({
  activeTab, setActiveTab, isManageMode, setIsManageMode,
  isGlobalLoading, isAnalyzingStandard, selectedItemIdsSize,
  handleBulkDeleteItems, handleAnalyzeCharacter, handleRefreshLetters, 
  isRefreshingLetters, onClose, hasBelongings
}) => {
  const TAB_DEFINITIONS = [
    { id: 'ability', label: '능력', mobileOnly: true },
    { id: 'core', label: '보고서', mobileOnly: false },
    { id: 'quests', label: '임무', mobileOnly: false },
    { id: 'items', label: '소지품', mobileOnly: false },
    { id: 'letters', label: '서신함', mobileOnly: false }
  ] as const;

  return (
    <div className="shrink-0 bg-white dark:bg-[#121214] z-20 sticky top-0">
      {/* Desktop Tabs Header */}
      <nav className="h-14 flex items-center justify-between px-4 md:px-6 border-b border-gray-100 dark:border-gray-800" aria-label="분석 상세 메뉴">
        <div className="hidden md:flex h-full items-center gap-1">
          {TAB_DEFINITIONS.filter(t => !t.mobileOnly).map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`h-full px-5 flex items-center justify-center text-[11px] font-bold uppercase tracking-[0.1em] transition-colors relative ${activeTab === tab.id ? 'text-gray-900 dark:text-white border-b-2 border-gray-900 dark:border-white' : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'}`}
              aria-selected={activeTab === tab.id}
              role="tab"
            >
              {tab.label}
            </button>
          ))}
        </div>
        <div id="analysis-modal-title" className="md:hidden text-[10px] font-bold uppercase tracking-[0.2em] text-gray-500 px-2">UNIT ANALYSIS</div>

        {/* Action Buttons */}
        <div className="flex items-center gap-3 shrink-0">
          {activeTab === 'items' && (
            isManageMode ? (
              <div className="flex items-center gap-2 animate-in fade-in duration-300">
                <DeleteButton onConfirm={handleBulkDeleteItems} disabled={selectedItemIdsSize === 0} title="선택 항목 삭제" confirmTitle="선택한 소지품을 삭제하시겠습니까?" />
                <button onClick={() => setIsManageMode(false)} className="p-1.5 text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-colors" title="관리 종료">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" /></svg>
                </button>
                <div className="w-px h-3 bg-gray-200 dark:bg-gray-700" />
              </div>
            ) : (
              <div className="flex items-center gap-2 animate-in fade-in duration-300">
                <button onClick={() => setIsManageMode(true)} disabled={isGlobalLoading || !hasBelongings} className="p-1.5 text-gray-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-colors disabled:opacity-30" title="소지품 관리">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6h9.75M10.5 6a1.5 1.5 0 1 1-3 0m3 0a1.5 1.5 0 1 0-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m-9.75 0h9.75" /></svg>
                </button>
                <div className="w-px h-3 bg-gray-200 dark:bg-gray-700" />
              </div>
            )
          )}
          {activeTab !== 'items' && (
            <>
              <RefreshButton 
                onClick={activeTab === 'letters' ? handleRefreshLetters : handleAnalyzeCharacter} 
                isLoading={activeTab === 'letters' ? isRefreshingLetters : isAnalyzingStandard} 
                disabled={isGlobalLoading} 
                title="데이터 갱신" 
              />
              <div className="w-px h-3 bg-gray-200 dark:bg-gray-700" />
            </>
          )}
          <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-black dark:hover:text-white transition-colors" aria-label="보고서 닫기">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" /></svg>
          </button>
        </div>
      </nav>

      {/* Mobile Tabs Switcher */}
      <div className="md:hidden flex border-b border-gray-100 dark:border-gray-800 h-10 bg-gray-50/50 dark:bg-black/20" role="tablist">
        {TAB_DEFINITIONS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 flex items-center justify-center text-[10px] font-bold uppercase tracking-[0.1em] transition-colors relative ${activeTab === tab.id ? 'text-gray-900 dark:text-white bg-white dark:bg-[#121214] shadow-sm border-b-2 border-gray-900 dark:border-white' : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'}`}
            aria-selected={activeTab === tab.id}
            role="tab"
          >
            {tab.label}
          </button>
        ))}
      </div>
    </div>
  );
});
