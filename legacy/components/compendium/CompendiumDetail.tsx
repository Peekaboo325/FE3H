
import React, { useRef, useEffect } from 'react';
// [Fix] Updated import path to use types/index to avoid deprecated root types file
import { CompendiumEntry } from '../../types/index';
import { SectionHeader } from '../ui/SectionHeader';
import { IconButton } from '../ui/IconButton';
import { MarkdownContent } from '../SharedComponents';
import { HighlightedText } from '../ui/HighlightedText';

interface CompendiumDetailProps {
  entry: CompendiumEntry;
  prevEntry: CompendiumEntry | null;
  nextEntry: CompendiumEntry | null;
  searchQuery: string;
  activeIndex: number;
  onNavigate: (id: string) => void;
  onEdit: () => void;
  onClose: () => void;
}

export const CompendiumDetail: React.FC<CompendiumDetailProps> = ({
  entry,
  prevEntry,
  nextEntry,
  searchQuery,
  activeIndex,
  onNavigate,
  onEdit,
  onClose
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
  }, [entry.id]);

  return (
    <>
      <SectionHeader 
        onClose={onClose} 
        leftContent={
            <div className="md:hidden">
                <IconButton onClick={() => onNavigate('')} title="목록으로">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" /></svg>
                </IconButton>
            </div>
        } 
        rightContent={
            <IconButton onClick={onEdit} title="수정">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" /></svg>
            </IconButton>
        }
      />
      <div ref={scrollRef} className="flex-1 overflow-y-auto custom-scrollbar p-6 md:p-10">
        <div className="max-w-3xl mx-auto space-y-12 animate-in fade-in duration-500 pb-20">
          
          <header className="border-b border-gray-100 dark:border-gray-800 pb-8">
            <div className="flex items-center gap-2 mb-2">
                <span className="text-xs font-bold text-blue-600 dark:text-blue-400 tracking-[0.2em] uppercase">제{activeIndex + 1}권</span>
                <div className="flex items-center gap-1 ml-auto">
                    <button onClick={() => prevEntry && onNavigate(prevEntry.id)} disabled={!prevEntry} className="p-1 text-gray-400 hover:text-blue-500 disabled:opacity-20"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" /></svg></button>
                    <button onClick={() => nextEntry && onNavigate(nextEntry.id)} disabled={!nextEntry} className="p-1 text-gray-400 hover:text-blue-500 disabled:opacity-20"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" /></svg></button>
                </div>
            </div>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-gray-100 leading-tight">
                <HighlightedText text={entry.title} highlight={searchQuery} />
            </h1>
            {/* [PO's SPEC] 소주제 제목 나열 프리뷰 추가 */}
            {entry.sections.length > 0 && (
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mt-2 opacity-80 leading-relaxed break-keep">
                    {entry.sections.map(s => s.subtitle).filter(Boolean).join(' • ')}
                </p>
            )}
          </header>

          {/* Sections Area */}
          <div className="space-y-12">
            {entry.sections.map((section, i) => (
              <section key={i} className="animate-in fade-in slide-in-from-top-2 duration-500" style={{ animationDelay: `${i * 100}ms` }}>
                {section.subtitle && (
                  <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-3">
                    <span className="w-1.5 h-4 bg-blue-500 rounded-full shrink-0" />
                    <HighlightedText text={section.subtitle} highlight={searchQuery} />
                  </h3>
                )}
                <div className="text-sm leading-8 text-gray-700 dark:text-gray-300 font-sans text-justify">
                    <MarkdownContent content={section.content} variant="compact" />
                </div>
              </section>
            ))}
          </div>

          {/* Footer Navigation: Chronicle-style Benchmark */}
          <div className="mt-16 pt-10 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between gap-4">
              <div className="w-16 md:w-1/4 shrink-0">
                  {prevEntry && (
                      <button onClick={() => onNavigate(prevEntry.id)} className="group flex items-center gap-1.5 transition-all text-gray-400 hover:text-blue-600 dark:hover:text-blue-400">
                          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" /></svg>
                          <span className="hidden md:block text-xs font-bold truncate">제{activeIndex}권</span>
                      </button>
                  )}
              </div>
              <div className="flex-1 flex justify-center min-w-0">
                  <button onClick={() => onNavigate('')} className="px-3 md:px-6 py-3 border border-blue-200 dark:border-blue-900 text-blue-600 dark:text-blue-400 text-[11px] md:text-xs font-bold uppercase tracking-widest rounded-none hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all shadow-sm active:scale-95 whitespace-nowrap overflow-hidden text-ellipsis">전체 목록으로</button>
              </div>
              <div className="w-16 md:w-1/4 shrink-0 flex justify-end">
                  {nextEntry && (
                      <button onClick={() => onNavigate(nextEntry.id)} className="group flex items-center gap-1.5 transition-all text-gray-400 hover:text-blue-600 dark:hover:text-blue-400">
                          <span className="hidden md:block text-xs font-bold truncate">제{activeIndex + 2}권</span>
                          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" /></svg>
                      </button>
                  )}
              </div>
          </div>
        </div>
      </div>
    </>
  );
};