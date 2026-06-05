
import React, { useLayoutEffect, useRef, useEffect } from 'react';
import { MarkdownContent, LoadingIndicator } from '../SharedComponents';
import { useAppStore } from '../../store/useAppStore';
import { IconButton } from '../ui/IconButton';

interface AdvisorModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AdvisorModal: React.FC<AdvisorModalProps> = ({ isOpen, onClose }) => {
  const { advisorMessages = [], advisorInput = "", isAdvisorLoading, setAdvisorMessages, setAdvisorInput, handleAskAdvisor } = useAppStore();
  const chatEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (isOpen) chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [advisorMessages, isOpen, isAdvisorLoading]);

  useLayoutEffect(() => {
    const textarea = inputRef.current;
    if (textarea) {
        textarea.style.height = 'auto';
        const maxHeight = 120;
        // 최소 높이를 44px로 보정
        const newHeight = Math.max(44, Math.min(textarea.scrollHeight, maxHeight));
        textarea.style.height = `${newHeight}px`;
        textarea.style.overflowY = textarea.scrollHeight > maxHeight ? 'auto' : 'hidden';
    }
  }, [advisorInput]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-0 md:p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white dark:bg-gray-900 w-full md:max-w-4xl h-full md:h-[85vh] border-0 md:border border-gray-800 shadow-2xl flex flex-col animate-in zoom-in duration-300">
        <div className="h-14 flex justify-between items-center px-4 border-b border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 shrink-0 z-10">
            <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-gray-500">TACTICAL ADVISOR</h3>
            <div className="flex items-center gap-1">
                <IconButton onClick={() => setAdvisorMessages([])} variant="danger" title="대화 내역 지우기">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" /></svg>
                </IconButton>
                <div className="w-px h-3 bg-gray-200 dark:bg-gray-700 mx-2" />
                <IconButton onClick={onClose} title="닫기">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" /></svg>
                </IconButton>
            </div>
        </div>
        <div className="flex-1 overflow-y-auto p-4 md:p-6 bg-gray-50 dark:bg-gray-800/50 custom-scrollbar space-y-6">
           {advisorMessages.length === 0 ? (
               <div className="h-full flex flex-col items-center justify-center text-center opacity-50 space-y-4 animate-in fade-in duration-700">
                   <div className="w-16 h-16 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-3xl grayscale">💡</div>
                   <div>
                       <p className="text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest leading-relaxed break-keep">
                           아직 쓰이지 않은 역사입니다.<br/>첫 문장을 시작하십시오.
                       </p>
                   </div>
               </div>
           ) : (
               advisorMessages.map((msg, idx) => {
                   const isUser = msg?.role === 'user';
                   return (
                       <div key={idx} className={`flex ${isUser ? 'justify-end' : 'justify-start'} animate-in fade-in slide-in-from-bottom-2 duration-300`}>
                           <div className={`
                                max-w-[85%] md:max-w-[75%] p-3 md:p-4 text-sm leading-relaxed shadow-sm border transition-all duration-200
                                ${isUser 
                                    ? 'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 border-gray-200 dark:border-gray-700 rounded-[16px] rounded-tr-none' 
                                    : 'bg-amber-50 dark:bg-amber-900/20 text-gray-800 dark:text-gray-200 border-amber-200 dark:border-amber-700/50 rounded-[16px] rounded-tl-none'
                                }
                           `}>
                               {isUser ? (
                                   <div className="whitespace-pre-wrap break-words text-left">{msg?.content ?? ""}</div>
                               ) : (
                                   <div className="prose-custom prose-compact dark:text-gray-200 [&_p]:text-left">
                                       <MarkdownContent content={msg?.content ?? ""} />
                                   </div>
                               )}
                           </div>
                       </div>
                   );
               })
           )}
           {isAdvisorLoading && (
             <div className="flex justify-start animate-in fade-in slide-in-from-bottom-2 duration-300">
               <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700/50 rounded-[16px] rounded-tl-none p-4 shadow-sm">
                 <LoadingIndicator variant="advisor" />
               </div>
             </div>
           )}
           <div ref={chatEndRef} />
        </div>
        <div className="p-4 border-t border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 shrink-0">
            <div className="flex items-end gap-3 max-w-4xl mx-auto">
                {/* Center Input Container */}
                <div className="relative flex-1 flex items-end">
                    <textarea 
                        ref={inputRef} 
                        value={advisorInput} 
                        onChange={(e) => setAdvisorInput(e.target.value)} 
                        onKeyDown={(e) => { 
                            const isMobile = window.innerWidth < 768;
                            if (e.key === 'Enter') {
                                if (isMobile) {
                                    // Mobile: Enter always inserts a new line
                                    return;
                                }
                                if (!e.shiftKey) {
                                    // Desktop: Enter sends, Shift+Enter inserts new line
                                    e.preventDefault(); 
                                    handleAskAdvisor(); 
                                }
                            }
                        }} 
                        placeholder="" 
                        className="w-full min-h-[44px] h-auto bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-100 rounded-2xl px-4 py-[9px] focus:outline-none text-sm resize-none custom-scrollbar transition-all focus:border-blue-500 dark:focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 placeholder-gray-400 leading-6 max-h-[120px] box-border" 
                        rows={1} 
                    />
                </div>
                {/* Right Send Button Container */}
                <div className="shrink-0 h-11 flex items-end">
                    <button 
                        onClick={handleAskAdvisor} 
                        disabled={isAdvisorLoading || !advisorInput.trim()} 
                        className="h-11 w-11 bg-gray-900 dark:bg-gray-100 text-white dark:text-black rounded-2xl hover:opacity-80 disabled:opacity-30 disabled:hover:opacity-30 transition-all shadow-sm flex items-center justify-center border border-transparent box-border"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="w-5 h-5">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 10.5 12 3m0 0 7.5 7.5M12 3v18" />
                        </svg>
                    </button>
                </div>
            </div>
        </div>
      </div>
    </div>
  );
};
