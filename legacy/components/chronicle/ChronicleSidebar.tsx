
import React, { useState, useMemo } from 'react';
import { ChronicleEntry } from '../../types/index';
import { IconButton } from '../ui/IconButton';
import { FodlanSearchBar } from '../ui/FodlanSearchBar';
import { HighlightedText } from '../ui/HighlightedText';
import { matchesSmartly } from '../../services/system/searchEngine';
import { getEpRangeText, parseMeta } from '../../utils/chronicleUtils';

interface ChronicleSidebarProps {
  chronicles: ChronicleEntry[];
  activeEntryId: string | null;
  isEditMode: boolean;
  onSelectEntry: (id: string) => void;
  onClose: () => void;
  className?: string;
  searchQuery: string;
  onSearchChange: (query: string) => void;
}

export const ChronicleSidebar: React.FC<ChronicleSidebarProps> = ({
  chronicles = [],
  activeEntryId,
  isEditMode,
  onSelectEntry,
  onClose,
  className = "",
  searchQuery,
  onSearchChange
}) => {
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');

  const filteredAndSortedChronicles = useMemo(() => {
      let result = [...(chronicles ?? [])];
      if (searchQuery.trim()) {
          const query = searchQuery;
          result = result.filter(c => 
              matchesSmartly(c?.title, query) || 
              matchesSmartly(c?.range, query) || 
              matchesSmartly(c?.summary, query) || 
              c?.keywords?.some(k => matchesSmartly(k, query)) || 
              (c?.tags ? (Object.values(c.tags) as string[][]).flat().some(k => matchesSmartly(k as string, query)) : false) || 
              (c?.tags ? (Object.keys(c.tags) as string[]).some(k => matchesSmartly(k as string, query)) : false) || 
              matchesSmartly(c?.date, query)
          );
      }
      result.sort((a, b) => sortOrder === 'desc' ? (b?.timestamp ?? 0) - (a?.timestamp ?? 0) : (a?.timestamp ?? 0) - (b?.timestamp ?? 0));
      return result;
  }, [chronicles, sortOrder, searchQuery]);

  return (
    <div className={`w-full md:w-80 border-r border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-black flex-col h-full shrink-0 relative ${className}`}>
        <div className="h-14 px-4 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-[#121214] flex justify-between items-center shrink-0">
            <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-gray-500">ARCHIVES</h3>
            <div className="flex items-center gap-1">
                <button onClick={() => setSortOrder(prev => prev === 'desc' ? 'asc' : 'desc')} className="p-1.5 text-gray-400 hover:text-blue-500 rounded hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors" title={sortOrder === 'desc' ? "최신순" : "과거순"}>
                    {sortOrder === 'desc' ? (
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M3 4.5h14.25M3 9h9.75M3 13.5h9.75m4.5-4.5v12m0 0-3.75-3.75M17.25 21 21 17.25" /></svg>
                    ) : (
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M3 4.5h14.25M3 9h9.75M3 13.5h5.25m5.25-.75L17.25 9m0 0L21 12.75M17.25 9v12" /></svg>
                    )}
                </button>
                <div className="md:hidden"><IconButton onClick={onClose} title="닫기"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" /></svg></IconButton></div>
            </div>
        </div>
        <div className="flex-1 overflow-y-auto custom-scrollbar p-0 pb-20 relative">
            {(chronicles ?? []).length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center opacity-50 p-8 select-none animate-in fade-in duration-700">
                    <div className="text-3xl mb-4 grayscale">📜</div>
                    <p className="text-[11px] text-gray-500 dark:text-gray-400 font-bold uppercase tracking-widest break-keep leading-relaxed">아직 쓰이지 않은 역사입니다.<br/>첫 문장을 시작하십시오.</p>
                </div>
            ) : filteredAndSortedChronicles.length === 0 ? (
                <div className="text-center py-10 text-gray-400 text-xs px-4">검색 결과가 없습니다.</div>
            ) : (
                filteredAndSortedChronicles.map(entry => {
                    const { title: rangeTitle } = parseMeta(entry?.range ?? "");
                    const isSelected = activeEntryId === entry?.id;
                    return (
                        <div 
                            key={entry?.id} 
                            onClick={() => { if(!isEditMode && entry?.id) onSelectEntry(entry.id); }} 
                            className={`w-full p-4 cursor-pointer transition-all duration-200 relative group border-y border-r-0 ${isSelected ? 'bg-white dark:bg-[#121214] border-gray-200 dark:border-gray-800 -mr-[1px] z-10' : 'bg-transparent border-t-transparent border-b-gray-200/50 dark:border-b-gray-800/50 hover:bg-white/50 dark:hover:bg-gray-900/50'}`}
                        >
                            <div className="flex flex-col gap-1.5">
                                <div className="flex items-center justify-between w-full">
                                    <div className="flex items-center gap-2 text-[10px] min-w-0 overflow-hidden">
                                        <HighlightedText text={rangeTitle} highlight={searchQuery} className={`font-bold transition-colors shrink-0 ${isSelected ? 'text-blue-600 dark:text-blue-400' : 'text-gray-400 group-hover:text-blue-500'}`} />
                                        <span className="text-gray-300 dark:text-gray-700 shrink-0">•</span>
                                        <span className={`font-bold transition-colors ${isSelected ? 'text-gray-500 dark:text-gray-400' : 'text-gray-400 dark:text-gray-600'}`}>
                                            {getEpRangeText(entry?.contained_episodes)}
                                        </span>
                                    </div>
                                    {entry?.isReferenced && (
                                        <div className="text-blue-600 dark:text-blue-400 animate-in zoom-in duration-300 shrink-0 ml-2" title="참조 중">
                                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5"><path strokeLinecap="round" strokeLinejoin="round" d="M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0111.186 0z" /></svg>
                                        </div>
                                    )}
                                </div>
                                <h4 className={`text-sm font-bold leading-snug break-keep transition-colors pr-4 ${isSelected ? 'text-gray-900 dark:text-gray-100' : 'text-gray-500 dark:text-gray-500'}`}>
                                    <HighlightedText text={entry?.title ?? ""} highlight={searchQuery} />
                                </h4>
                            </div>
                            {isSelected && (<div className="absolute left-0 top-0 bottom-0 w-[3px] bg-blue-500" />)}
                        </div>
                    );
                })
            )}
        </div>
        <FodlanSearchBar 
            value={searchQuery}
            onChange={onSearchChange}
            placeholder="제목, 내용 검색..."
        />
    </div>
  );
};
