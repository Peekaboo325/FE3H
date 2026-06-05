
import React, { useEffect, useRef } from 'react';
import { MarkdownContent } from '../SharedComponents';
import { IconButton } from '../ui/IconButton';
import { RefreshButton } from '../ui/RefreshButton'; 
import { SectionHeader } from '../ui/SectionHeader';
import { ChronicleEntry } from '../../types/index';
import { DialogueCard } from '../DialogueCard';
import { ChronicleField } from '../../services/gemini/prompts';

// [Import Extracted Infrastructure]
import { HighlightedText } from '../ui/HighlightedText';
import { getHighlightedMarkdown } from '../../services/system/searchEngine';
import { 
    getStateColor, 
    getEpRangeText,
    parseMeta
} from '../../utils/chronicleUtils';

interface ChronicleDetailProps {
  entry: ChronicleEntry;
  prevEntry: ChronicleEntry | null;
  nextEntry: ChronicleEntry | null;
  searchQuery: string;
  isProcessing: boolean;
  processingField: ChronicleField | 'full' | null;
  onRefresh: (entry: ChronicleEntry, field: ChronicleField) => void;
  onNavigate: (id: string) => void;
  onJump: (messageId: string | undefined) => void;
  onToggleRef: (id: string) => void;
  onEdit: (active: boolean) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}

/**
 * [Sub-Component: TagSection]
 * Internal helper for categorized keywords.
 */
const TagSection: React.FC<{ title: string; items: string[] | undefined; colorClass: string; searchQuery: string }> = ({ title, items, colorClass, searchQuery }) => {
    if (!items || items.length === 0) return null;
    return (
        <div className="flex items-start gap-2 py-3 border-b border-gray-100 dark:border-gray-800 last:border-0">
            <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest w-12 shrink-0 mt-1">{title}</h4>
            <div className="flex flex-wrap gap-2 flex-1">
                {items.map((item, i) => (
                    <span key={i} className={`px-2 py-1 text-[10px] font-bold rounded border ${colorClass} leading-none`}>
                        <HighlightedText text={item} highlight={searchQuery} />
                    </span>
                ))}
            </div>
        </div>
    );
};

export const ChronicleDetail: React.FC<ChronicleDetailProps> = ({
  entry,
  prevEntry,
  nextEntry,
  searchQuery,
  isProcessing,
  processingField,
  onRefresh,
  onNavigate,
  onJump,
  onToggleRef,
  onEdit,
  onClose
}) => {
  const { title: rangeTitle } = parseMeta(entry.range);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // [UX] Reset scroll position when entry changes
  useEffect(() => {
    if (scrollContainerRef.current) {
        scrollContainerRef.current.scrollTop = 0;
    }
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
                <>
                    <IconButton 
                        onClick={(e) => { e.stopPropagation(); onToggleRef(entry.id); }} 
                        disabled={isProcessing} 
                        title={entry.isReferenced ? "참조 해제" : "참조하기"} 
                        className={entry.isReferenced ? "text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20" : ""}
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill={entry.isReferenced ? "currentColor" : "none"} stroke="currentColor" strokeWidth={2} className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0111.186 0z" /></svg>
                    </IconButton>
                    <IconButton 
                        onClick={(e) => { e.stopPropagation(); onEdit(true); }} 
                        disabled={isProcessing} 
                        title="연대기 수정"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" /></svg>
                    </IconButton>
                </>
            } 
        />
        <div ref={scrollContainerRef} className="flex-1 overflow-y-auto custom-scrollbar p-6 md:p-10">
            <div className="mb-10 border-b border-gray-100 dark:border-gray-800 pb-8">
                <div className="flex flex-col gap-2">
                    <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2.5">
                            <span className="text-sm font-bold text-blue-600 dark:text-blue-400 tracking-tight shrink-0">{rangeTitle}</span>
                            <span className="w-px h-2.5 bg-gray-200 dark:bg-gray-700" />
                            <span className="text-sm font-bold text-gray-600 dark:text-gray-400 tracking-tight">{getEpRangeText(entry.contained_episodes)}</span>
                        </div>
                        <div className="flex items-center gap-1">
                            <button onClick={() => prevEntry && onNavigate(prevEntry.id)} disabled={!prevEntry} className="p-1.5 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" /></svg>
                            </button>
                            <div className="w-px h-3 bg-gray-200 dark:bg-gray-800" />
                            <button onClick={() => nextEntry && onNavigate(nextEntry.id)} disabled={!nextEntry} className="p-1.5 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" /></svg>
                            </button>
                        </div>
                    </div>
                    <h1 className="text-xl md:text-2xl font-bold text-gray-900 dark:text-gray-100 leading-tight mb-1">
                        <HighlightedText text={entry.title} highlight={searchQuery} />
                    </h1>
                    <div className="text-xs font-medium text-gray-400 dark:text-gray-500 tracking-tight">
                        <HighlightedText text={entry.date} highlight={searchQuery} />
                    </div>
                </div>
            </div>
            
            <div className="space-y-12">
                {/* Main Content */}
                <div className="space-y-12">
                    {/* Narrative Summary Section */}
                    <div>
                        <div className="flex items-center justify-between mb-3">
                            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest">Narrative Summary</h3>
                            <RefreshButton onClick={() => onRefresh(entry, 'summary')} isLoading={isProcessing && processingField === 'summary'} disabled={isProcessing} title="줄거리 요약 재생성" size="sm" />
                        </div>
                        <div className="prose prose-sm dark:prose-invert max-w-none text-gray-800 dark:text-gray-200 leading-8 font-sans text-justify mb-8">
                            <MarkdownContent content={getHighlightedMarkdown(entry.summary, searchQuery)} />
                        </div>

                        {/* State Changes Section */}
                        {entry.state_changes && entry.state_changes.length > 0 && (
                            <div className="animate-in fade-in duration-500">
                                <div className="flex items-center justify-between mb-4">
                                    <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-[0.2em]">State Changes</h3>
                                    <RefreshButton onClick={() => onRefresh(entry, 'state_changes')} isLoading={isProcessing && processingField === 'state_changes'} disabled={isProcessing} title="상태 변화 데이터 갱신" size="sm" />
                                </div>
                                <div className="space-y-3">
                                    {entry.state_changes.map((state, i) => (
                                        <div key={i} className="flex items-stretch gap-4 p-3 bg-gray-50/50 dark:bg-gray-800/30 border border-gray-100 dark:border-gray-800 min-h-[64px]">
                                            <div className={`w-12 flex items-center justify-center rounded-sm text-[11px] font-bold border shrink-0 leading-tight text-center break-keep whitespace-pre-wrap ${getStateColor(i)}`}>{state.category}</div>
                                            <div className="flex-1 flex items-center py-1">
                                                <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed break-keep">
                                                    <HighlightedText text={state.content} highlight={searchQuery} />
                                                </p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Key Events Section */}
                    {entry.key_events && entry.key_events.length > 0 && (
                        <div>
                            <div className="flex items-center justify-between mb-3">
                                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest">Key Events</h3>
                                <RefreshButton onClick={() => onRefresh(entry, 'key_events')} isLoading={isProcessing && processingField === 'key_events'} disabled={isProcessing} title="사건 기록 재생성" size="sm" />
                            </div>
                            <ul className="space-y-3">
                                {entry.key_events.map((event, i) => (
                                    <li key={i} className="flex gap-3 text-sm text-gray-700 dark:text-gray-300">
                                        <span className="font-bold text-gray-300 dark:text-gray-600 font-mono text-xs mt-0.5">{(i + 1).toString().padStart(2, '0')}</span>
                                        <span className="leading-snug"><HighlightedText text={event} highlight={searchQuery} /></span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}

                    {/* Major Dialogues Section */}
                    {entry.major_dialogues && entry.major_dialogues.filter(d => d.line && d.line.trim().length > 0).length > 0 && (
                        <div>
                            <div className="flex items-center justify-between mb-5">
                                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest">Major Dialogues</h3>
                                <RefreshButton onClick={() => onRefresh(entry, 'major_dialogues')} isLoading={isProcessing && processingField === 'major_dialogues'} disabled={isProcessing} title="주요 대사 다시 추출" size="sm" />
                            </div>
                            <div className="space-y-4">
                                {entry.major_dialogues.map((d, i) => (
                                    <DialogueCard key={i} speakerName={d.speaker} content={d.line} withQuotes={true} />
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* Notes & Mysteries Section */}
                <div className="bg-gray-50/50 dark:bg-gray-800/30 p-6 rounded-lg border border-gray-100 dark:border-gray-800">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-[0.2em]">Notes & Mysteries</h3>
                        <RefreshButton onClick={() => onRefresh(entry, 'seeds')} isLoading={isProcessing && processingField === 'seeds'} disabled={isProcessing} title="미스터리 정밀 분석" size="sm" className="!text-gray-400 dark:!text-gray-500" />
                    </div>
                    {(!entry.seeds || entry.seeds.length === 0) ? (
                        <div className="py-10 flex flex-col items-center justify-center text-center group">
                            <p className="text-[11px] font-bold text-gray-400 dark:text-gray-500 mb-5 break-keep px-4 leading-relaxed">기록에서 발견되지 않은 미스터리를 추적하십시오</p>
                            <button onClick={() => onRefresh(entry, 'seeds')} disabled={isProcessing} className="px-5 py-2.5 border border-gray-200 dark:border-gray-700 text-[10px] font-bold uppercase tracking-widest text-gray-500 hover:text-blue-500 hover:border-blue-500 dark:hover:text-blue-400 dark:hover:border-blue-400 transition-all rounded disabled:opacity-30 active:scale-95">
                                {isProcessing && processingField === 'seeds' ? '복선 추적 중...' : '분석 시작'}
                            </button>
                        </div>
                    ) : (
                        <ul className="space-y-3">
                            {entry.seeds.map((seed, i) => (
                                <li key={i} className="text-xs text-gray-600 dark:text-gray-400 flex items-start gap-2 relative pl-4 leading-relaxed">
                                    <span className="absolute left-0 top-2 w-1.5 h-1.5 bg-gray-300 dark:bg-gray-600 rounded-sm" />
                                    <span className="break-keep font-medium"><HighlightedText text={seed} highlight={searchQuery} /></span>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>

                {/* Tags Section */}
                {entry.tags && (
                    <div className="pt-4 border-0">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest">Archive Keywords</h3>
                            <RefreshButton onClick={() => onRefresh(entry, 'tags')} isLoading={isProcessing && processingField === 'tags'} disabled={isProcessing} title="키워드 태그 다시 추출" size="sm" />
                        </div>
                        <div className="flex flex-col gap-0 border-t border-gray-100 dark:border-gray-800">
                            <TagSection searchQuery={searchQuery} title="인물" items={entry.tags.person} colorClass="bg-rose-50 text-rose-600 border-rose-100 dark:bg-rose-900/20 dark:text-rose-400 dark:border-rose-900/30" />
                            <TagSection searchQuery={searchQuery} title="장소" items={entry.tags.place} colorClass="bg-teal-50 text-teal-600 border-teal-100 dark:bg-teal-900/20 dark:text-teal-400 dark:border-teal-900/30" />
                            <TagSection searchQuery={searchQuery} title="주제" items={entry.tags.topic} colorClass="bg-amber-50 text-amber-700 border-amber-100 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-900/30" />
                            <TagSection searchQuery={searchQuery} title="물품" items={entry.tags.item} colorClass="bg-indigo-50 text-indigo-600 border-indigo-100 dark:bg-indigo-900/20 dark:text-indigo-400 dark:border-indigo-900/30" />
                            <TagSection searchQuery={searchQuery} title="정서" items={entry.tags.sentiment} colorClass="bg-fuchsia-50 text-fuchsia-600 border-fuchsia-100 dark:bg-fuchsia-900/20 dark:text-fuchsia-400 dark:border-fuchsia-900/30" />
                        </div>
                    </div>
                )}
            </div>

            {/* Footer Navigation */}
            <div className="mt-16 pt-10 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between gap-4">
                <div className="w-16 md:w-1/4 shrink-0">
                    {prevEntry && (
                        <button onClick={() => onNavigate(prevEntry.id)} className="group flex items-center gap-1.5 transition-all text-gray-400 hover:text-blue-600 dark:hover:text-blue-400">
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" /></svg>
                            <span className="hidden md:block text-xs font-bold truncate max-w-[120px]">{parseMeta(prevEntry.range).title}</span>
                        </button>
                    )}
                </div>
                <div className="flex-1 flex justify-center min-w-0">
                    <button onClick={() => onJump(entry.startMessageId)} className="px-3 md:px-6 py-3 border border-blue-200 dark:border-blue-900 text-blue-600 dark:text-blue-400 text-[11px] md:text-xs font-bold uppercase tracking-widest rounded-none hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all shadow-sm active:scale-95 whitespace-nowrap overflow-hidden text-ellipsis">기록된 시점으로 돌아가기</button>
                </div>
                <div className="w-16 md:w-1/4 shrink-0 flex justify-end">
                    {nextEntry && (
                        <button onClick={() => onNavigate(nextEntry.id)} className="group flex items-center gap-1.5 transition-all text-gray-400 hover:text-blue-600 dark:hover:text-blue-400">
                            <span className="hidden md:block text-xs font-bold truncate max-w-[120px]">{parseMeta(nextEntry.range).title}</span>
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" /></svg>
                        </button>
                    )}
                </div>
            </div>
        </div>
    </>
  );
};
