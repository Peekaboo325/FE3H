
import React, { useState, useMemo, useEffect } from 'react';
import { useAppStore } from '../../store/useAppStore';
// [Fix] Updated import path to use types/index to avoid deprecated root types file
import { CompendiumEntry } from '../../types/index';
import { CompendiumSidebar } from '../compendium/CompendiumSidebar';
import { CompendiumDetail } from '../compendium/CompendiumDetail';
import { CompendiumEditor } from '../compendium/CompendiumEditor';

interface CompendiumModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const CompendiumModal: React.FC<CompendiumModalProps> = ({ isOpen, onClose }) => {
  const { 
    compendium, handleUpdateCompendiumEntry, handleDeleteCompendiumEntry,
    viewingCompendiumId, setViewingCompendiumId, handleCreateCompendiumEntry
  } = useAppStore();

  const [isEditMode, setIsEditMode] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // 'new' 상태일 때 에디터 자동 활성화
  useEffect(() => {
    if (viewingCompendiumId === 'new') {
      setIsEditMode(true);
    }
  }, [viewingCompendiumId]);

  // [Phase DnD] 정렬 기준을 order 필드로 고정 (없으면 timestamp 폴백)
  const absoluteCompendium = useMemo(() => 
    [...compendium].sort((a, b) => (a.order || a.timestamp) - (b.order || b.timestamp)), 
  [compendium]);

  const activeEntry = useMemo(() => {
    if (viewingCompendiumId === 'new') {
      return {
        id: 'new',
        title: '',
        sections: [{ subtitle: '', content: '' }],
        fragments: [],
        isPinned: true,
        timestamp: Date.now(),
        order: compendium.length + 1
      } as CompendiumEntry;
    }
    return compendium.find(c => c.id === viewingCompendiumId);
  }, [compendium, viewingCompendiumId]);

  const activeIndex = activeEntry && activeEntry.id !== 'new' 
    ? absoluteCompendium.findIndex(c => c.id === activeEntry.id) 
    : -1;
    
  const prevEntry = activeIndex > 0 ? absoluteCompendium[activeIndex - 1] : null;
  const nextEntry = activeIndex !== -1 && activeIndex < absoluteCompendium.length - 1 ? absoluteCompendium[activeIndex + 1] : null;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-0 md:p-4 font-sans text-gray-900 dark:text-gray-100">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white dark:bg-[#121214] w-full md:max-w-6xl h-full md:h-[90vh] border-0 md:border border-gray-200 dark:border-gray-800 shadow-2xl flex flex-col md:flex-row animate-in zoom-in duration-300 overflow-hidden md:rounded-sm">
        
        <CompendiumSidebar 
            compendium={compendium}
            activeEntryId={viewingCompendiumId}
            isEditMode={isEditMode}
            onSelectEntry={(id) => { setViewingCompendiumId(id); setIsEditMode(false); }}
            onClose={onClose}
            onCreate={handleCreateCompendiumEntry}
            className={activeEntry ? 'hidden md:flex' : 'flex'}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
        />

        <div className={`flex-1 flex flex-col h-full bg-white dark:bg-[#121214] relative overflow-hidden ${!activeEntry ? 'hidden md:flex' : 'flex'}`}>
            {activeEntry ? (
                isEditMode ? (
                    <CompendiumEditor 
                        initialData={activeEntry}
                        onSave={(data) => {
                            handleUpdateCompendiumEntry(data);
                            setIsEditMode(false);
                        }}
                        onCancel={() => {
                          if (viewingCompendiumId === 'new') setViewingCompendiumId(null);
                          setIsEditMode(false);
                        }}
                        onDelete={(id) => {
                            handleDeleteCompendiumEntry(id);
                            setIsEditMode(false);
                        }}
                        onClose={onClose}
                        onBack={() => setViewingCompendiumId(null)}
                    />
                ) : (
                    <CompendiumDetail 
                        entry={activeEntry}
                        prevEntry={prevEntry}
                        nextEntry={nextEntry}
                        searchQuery={searchQuery}
                        activeIndex={activeIndex}
                        onNavigate={setViewingCompendiumId}
                        onEdit={() => setIsEditMode(true)}
                        onClose={onClose}
                    />
                )
            ) : (
                <div className="h-full flex flex-col items-center justify-center text-center opacity-40 font-sans p-10">
                    <div className="text-5xl grayscale mb-6">📚</div>
                    <p className="text-sm font-bold text-gray-500 uppercase tracking-widest">열람할 견문록을 선택하십시오</p>
                    <p className="text-xs text-gray-400 mt-2">좌측 목록에서 항목을 선택하거나<br/>새로운 세계관 설정을 집필할 수 있습니다.</p>
                </div>
            )}
        </div>
      </div>
    </div>
  );
};

export default CompendiumModal;