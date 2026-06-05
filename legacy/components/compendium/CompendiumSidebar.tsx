
import React, { useMemo, useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { CompendiumEntry } from '../../types/index';
import { IconButton } from '../ui/IconButton';
import { FodlanSearchBar } from '../ui/FodlanSearchBar';
import { HighlightedText } from '../ui/HighlightedText';
import { matchesSmartly } from '../../services/system/searchEngine';
import { useAppStore } from '../../store/useAppStore';
import {
  DndContext, 
  closestCenter,
  DragOverlay,
} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useFodlanPhysics } from '../../hooks/useFodlanPhysics';

interface CompendiumSidebarProps {
  compendium: CompendiumEntry[];
  activeEntryId: string | null;
  isEditMode: boolean;
  onSelectEntry: (id: string) => void;
  onClose: () => void;
  onCreate: () => void;
  className?: string;
  searchQuery: string;
  onSearchChange: (query: string) => void;
}

/**
 * [UI Component: SortableCompendiumItem]
 * 모바일 최적화: 좌측 50% 핸들, 우측 50% 스크롤 영역
 */
const SortableCompendiumItem: React.FC<{
  entry: CompendiumEntry;
  isSelected: boolean;
  volumeIndex: number;
  searchQuery: string;
  isEditMode: boolean;
  onSelect: () => void;
}> = ({ entry, isSelected, volumeIndex, searchQuery, isEditMode, onSelect }) => {
  const [isMobile, setIsMobile] = useState(false);
  
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const { 
    attributes, listeners, setNodeRef, transform, transition, isDragging 
  } = useSortable({ id: entry.id, disabled: !!searchQuery.trim() });

  const style = {
    transform: transform ? CSS.Transform.toString(transform) : undefined,
    transition,
    opacity: isDragging ? 0.3 : 1,
    zIndex: isDragging ? 50 : 'auto',
    touchAction: isMobile ? 'pan-y' : 'none'
  };

  return (
    <div 
      ref={setNodeRef}
      style={style}
      {...(!isMobile ? attributes : {})}
      {...(!isMobile ? listeners : {})}
      className={`w-full px-4 py-3 transition-all duration-200 relative group border-y border-r-0 select-none ${isSelected ? 'bg-white dark:bg-[#121214] border-gray-200 dark:border-gray-800 -mr-[1px] z-10' : 'bg-transparent border-t-transparent border-b-gray-200/50 dark:border-b-gray-800/50 hover:bg-white/50 dark:hover:bg-gray-900/50'} ${!isMobile ? 'cursor-grab active:cursor-grabbing' : ''}`}
    >
        {/* [PO's SPEC] 모바일 전용 좌측 50% 투명 DnD 활성 영역 */}
        {isMobile && (
          <div 
            className="absolute inset-y-0 left-0 w-1/2 z-30 touch-none cursor-grab active:cursor-grabbing"
            {...attributes}
            {...listeners}
            onClick={(e) => { if(!isEditMode) { e.stopPropagation(); onSelect(); } }}
          />
        )}

        <div className="flex flex-col gap-1 pointer-events-auto" onClick={() => { if(!isEditMode) onSelect(); }}>
            <div className="flex items-center justify-between">
                <span className={`text-[10px] font-bold uppercase tracking-widest ${isSelected ? 'text-blue-600 dark:text-blue-400' : 'text-gray-400'}`}>제{volumeIndex}권</span>
            </div>
            <h4 className={`text-sm font-bold leading-snug break-keep transition-colors ${isSelected ? 'text-gray-900 dark:text-gray-100' : 'text-gray-500'}`}>
                <HighlightedText text={entry.title} highlight={searchQuery} />
            </h4>
            <p className={`text-[10px] font-medium line-clamp-1 transition-colors ${isSelected ? 'text-gray-500 dark:text-gray-400' : 'text-gray-400 dark:text-gray-600'}`}>
                {entry.sections.map(s => s.subtitle).filter(Boolean).join(' • ')}
            </p>
        </div>
        {isSelected && (<div className="absolute left-0 top-0 bottom-0 w-[3px] bg-blue-500" />)}
    </div>
  );
};

const CompendiumDragOverlay: React.FC<{ entry: CompendiumEntry; volumeIndex: number }> = ({ entry, volumeIndex }) => (
  <div className="w-[280px] px-4 py-3 bg-white dark:bg-[#1c1c1f] shadow-2xl border border-blue-500/50 opacity-90 scale-105 cursor-grabbing rounded-sm">
    <div className="flex flex-col gap-1">
        <span className="text-[10px] font-bold text-blue-500 uppercase tracking-widest">제{volumeIndex}권</span>
        <h4 className="text-sm font-bold text-gray-900 dark:text-gray-100 leading-snug">{entry.title}</h4>
        <p className="text-[10px] text-gray-400 line-clamp-1">
            {entry.sections.map(s => s.subtitle).filter(Boolean).join(' • ')}
        </p>
    </div>
  </div>
);

export const CompendiumSidebar: React.FC<CompendiumSidebarProps> = ({
  compendium = [],
  activeEntryId,
  isEditMode,
  onSelectEntry,
  onClose,
  onCreate,
  className = "",
  searchQuery,
  onSearchChange
}) => {
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const handleReorderCompendium = useAppStore(state => state.handleReorderCompendium);
  
  const sortedCompendiumBase = useMemo(() => 
    [...compendium].sort((a, b) => (a.order || a.timestamp) - (b.order || b.timestamp)), 
  [compendium]);

  const { activeId, sensors, handleDragStart, handleDragEnd } = useFodlanPhysics(
    sortedCompendiumBase,
    (newEntries) => handleReorderCompendium(newEntries)
  );

  const filteredAndSortedCompendium = useMemo(() => {
    let result = [...compendium];
    if (searchQuery.trim()) {
      result = result.filter(c => 
        matchesSmartly(c.title, searchQuery) || 
        c.sections.some(s => matchesSmartly(s.subtitle, searchQuery) || matchesSmartly(s.content, searchQuery))
      );
    }
    
    result.sort((a, b) => {
        const aVal = a.order || a.timestamp;
        const bVal = b.order || b.timestamp;
        return sortOrder === 'desc' ? bVal - aVal : aVal - bVal;
    });
    return result;
  }, [compendium, searchQuery, sortOrder]);

  const activeDragEntry = useMemo(() => 
    compendium.find(c => c.id === activeId), 
  [compendium, activeId]);

  const activeDragVolumeIndex = useMemo(() => 
    activeDragEntry ? sortedCompendiumBase.findIndex(c => c.id === activeDragEntry.id) + 1 : 0,
  [sortedCompendiumBase, activeDragEntry]);

  return (
    <div className={`w-full md:w-80 border-r border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-black flex-col h-full shrink-0 relative ${className}`}>
        <div className="h-14 px-4 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-[#121214] flex justify-between items-center shrink-0">
            <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-gray-500">COMPENDIUM</h3>
            <div className="flex items-center gap-1">
                <button 
                    onClick={() => setSortOrder(prev => prev === 'desc' ? 'asc' : 'desc')} 
                    className="p-1.5 text-gray-400 hover:text-blue-500 rounded hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors" 
                    title={sortOrder === 'desc' ? "최신순" : "과거순"}
                >
                    {sortOrder === 'desc' ? (
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M3 4.5h14.25M3 9h9.75M3 13.5h9.75m4.5-4.5v12m0 0-3.75-3.75M17.25 21 21 17.25" /></svg>
                    ) : (
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M3 4.5h14.25M3 9h9.75M3 13.5h5.25m5.25-.75L17.25 9m0 0L21 12.75M17.25 9v12" /></svg>
                    )}
                </button>
                <IconButton onClick={onCreate} title="설정 추가" className="text-blue-500">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
                </IconButton>
                <div className="md:hidden"><IconButton onClick={onClose} title="닫기"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" /></svg></IconButton></div>
            </div>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar p-0 pb-20 relative">
            {compendium.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center opacity-50 p-8 select-none animate-in fade-in duration-700">
                    <div className="text-3xl mb-4 grayscale">📚</div>
                    <p className="text-[11px] text-gray-500 dark:text-gray-400 font-bold uppercase tracking-widest break-keep leading-relaxed">기록된 견문록이 없습니다.<br/>대륙의 전모를 새로이 집필하십시오.</p>
                </div>
            ) : filteredAndSortedCompendium.length === 0 ? (
                <div className="text-center py-10 text-gray-400 text-xs px-4">검색 결과가 없습니다.</div>
            ) : (
                <DndContext 
                  sensors={sensors} 
                  collisionDetection={closestCenter} 
                  onDragStart={handleDragStart} 
                  onDragEnd={handleDragEnd}
                >
                    <SortableContext 
                        items={filteredAndSortedCompendium.map(c => c.id)} 
                        strategy={verticalListSortingStrategy}
                    >
                        <div className="divide-y divide-gray-100 dark:divide-gray-800/30">
                            {filteredAndSortedCompendium.map((entry) => {
                                const isSelected = activeEntryId === entry.id;
                                const volumeIndex = sortedCompendiumBase.findIndex(c => c.id === entry.id) + 1;
                                return (
                                    <SortableCompendiumItem 
                                        key={entry.id}
                                        entry={entry}
                                        isSelected={isSelected}
                                        volumeIndex={volumeIndex}
                                        searchQuery={searchQuery}
                                        isEditMode={isEditMode}
                                        onSelect={() => onSelectEntry(entry.id)}
                                    />
                                );
                            })}
                        </div>
                    </SortableContext>

                    {createPortal(
                      <DragOverlay dropAnimation={null}>
                        {activeDragEntry ? (
                            <CompendiumDragOverlay entry={activeDragEntry} volumeIndex={activeDragVolumeIndex} />
                        ) : null}
                      </DragOverlay>,
                      document.body
                    )}
                </DndContext>
            )}
        </div>

        <FodlanSearchBar 
            value={searchQuery}
            onChange={onSearchChange}
            placeholder="기록 검색..."
        />
    </div>
  );
};
