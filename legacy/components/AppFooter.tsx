
import React, { useState } from 'react';
import { useAppStore } from '../store/useAppStore';
import * as selectors from '../store/selectors';
import { PenTool, SendHorizontal, Plus, X } from 'lucide-react';
import ChronicleActionDock from './ChronicleActionDock';
import { AppRefs } from '../store/types';
import Button from './ui/Button';

interface AppFooterProps {
    refs: AppRefs;
}

export const AppFooter: React.FC<AppFooterProps> = ({ refs }) => {
    const isChronicleMode = useAppStore(selectors.selectIsChronicleMode);
    const isChronicleProcessing = useAppStore(state => state.isChronicleProcessing);
    const attachedImage = useAppStore(selectors.selectAttachedImage);
    const inputValue = useAppStore(selectors.selectInputValue);
    const isLoading = useAppStore(selectors.selectIsLoading);
    const isDirectEntryMode = useAppStore(state => state.isDirectEntryMode);

    const {
        setInputValue, setAttachedImage, handleSendMessage, handleImageAttach,
        handleCreateChronicle, handleCancelChronicle, getSelectedMessages,
        setIsChronicleModalOpen, setIsInputFocused, setIsDirectEntryMode
    } = useAppStore();

    const [isActionMenuOpen, setIsActionMenuOpen] = useState(false);

    if (isChronicleMode) {
        return (
            <div className="fixed bottom-0 left-0 right-0 z-50 pb-6 md:pb-8 pt-4 pointer-events-none">
                <div className="pointer-events-auto">
                    <ChronicleActionDock 
                        selectionCount={getSelectedMessages()?.filter(m => m.role === 'model')?.length ?? 0} 
                        onCancel={handleCancelChronicle}
                        onCompile={handleCreateChronicle}
                        onViewArchives={() => { setIsChronicleModalOpen(true); handleCancelChronicle(); }}
                        isProcessing={isChronicleProcessing}
                    />
                </div>
            </div>
        );
    }

    return (
        <footer className="px-4 pt-4 pb-8 md:p-6 border-t border-gray-50 dark:border-gray-800 bg-white dark:bg-gray-900 z-10 relative pointer-events-auto">
            {attachedImage && (
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-4 z-50 animate-in slide-in-from-bottom-2 fade-in duration-300">
                    <div className="group relative cursor-pointer" onClick={() => { if (!isLoading) { setAttachedImage(null); if (refs.promptImageInputRef.current) refs.promptImageInputRef.current.value = ''; } }}>
                        <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-xl border border-white/20 dark:border-gray-700 p-2 rounded-xl shadow-lg ring-1 ring-black/5 dark:ring-white/5 overflow-hidden">
                            <img src={attachedImage} alt="Attachment Preview" className="h-24 md:h-32 w-auto object-cover rounded-lg shadow-sm group-hover:brightness-75 transition-all duration-300" referrerPolicy="no-referrer" />
                        </div>
                        {!isLoading && (
                            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-10">
                                <div className="bg-red-500/90 text-white p-3 rounded-full shadow-lg hover:bg-red-600 transition-colors transform scale-90 group-hover:scale-100">
                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" /></svg>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            <div className="max-w-3xl mx-auto flex items-end space-x-3">
                {/* Left Action Menu Container */}
                <div className="shrink-0 h-11 flex items-end">
                    <div className="relative flex items-center h-11">
                        <Button 
                            onClick={() => setIsActionMenuOpen(!isActionMenuOpen)}
                            disabled={isLoading}
                            size="icon"
                            variant={isActionMenuOpen ? 'primary' : 'secondary'}
                            className={`z-20 ${isActionMenuOpen ? 'rotate-45' : ''} h-11 w-11 box-border`}
                            title={isActionMenuOpen ? "메뉴 닫기" : "액션 메뉴 열기"}
                        >
                            {isActionMenuOpen ? <X size={20} /> : <Plus size={20} />}
                        </Button>

                        <div className={`absolute left-0 bottom-0 flex items-center space-x-2 transition-all duration-300 pointer-events-none z-30 ${isActionMenuOpen ? 'opacity-100 translate-x-14 pointer-events-auto' : 'opacity-0 translate-x-0'}`}>
                            <Button 
                                onClick={() => { refs.promptImageInputRef.current?.click(); setIsActionMenuOpen(false); }} 
                                disabled={isLoading}
                                size="icon"
                                variant="secondary"
                                className="bg-white dark:bg-gray-800 shadow-lg hover:scale-110 h-11 w-11 box-border" 
                                title="이미지 첨부"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 0 0 1.5-1.5V6a1.5 1.5 0 0 0-1.5-1.5H3.75A1.5 1.5 0 0 0 2.25 6v12a1.5 1.5 0 0 0 1.5 1.5Zm10.5-11.25h.008v.008h-.008V8.25Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z" /></svg>
                            </Button>
                            <Button 
                                onClick={() => { setIsDirectEntryMode(!isDirectEntryMode); setIsActionMenuOpen(false); }}
                                disabled={isLoading}
                                size="icon"
                                variant={isDirectEntryMode ? 'primary' : 'secondary'}
                                className={`shadow-lg hover:scale-110 h-11 w-11 box-border ${isDirectEntryMode ? 'bg-blue-600 text-white ring-2 ring-blue-500/20' : 'bg-white dark:bg-gray-800'}`}
                                title={isDirectEntryMode ? "직접 집필 모드 활성" : "직접 집필 모드로 전환"}
                            >
                                <PenTool size={18} strokeWidth={isDirectEntryMode ? 2.5 : 2} />
                            </Button>
                        </div>
                    </div>
                </div>

                <input type="file" ref={refs.promptImageInputRef} className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if(f) handleImageAttach(f); }} aria-label="이미지 파일 선택" />
                
                {/* Center Input Container */}
                <div className="relative flex-1 flex items-end">
                    <textarea 
                        ref={refs.mainInputRef} 
                        value={inputValue} 
                        onChange={(e) => setInputValue(e.target.value)} 
                        onFocus={() => setIsInputFocused(true)}
                        onBlur={() => setIsInputFocused(false)}
                        disabled={isLoading}
                        className={`w-full border text-gray-900 dark:text-gray-100 rounded-xl px-4 py-[9px] focus:outline-none text-sm resize-none custom-scrollbar transition-all focus:ring-1 focus:ring-blue-500/20 placeholder-gray-400 leading-6 min-h-[44px] h-auto box-border disabled:opacity-50 disabled:cursor-not-allowed ${isDirectEntryMode ? 'bg-blue-50/30 dark:bg-blue-900/10 border-blue-300 dark:border-blue-800 focus:border-blue-500' : 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 focus:border-blue-500'}`}
                        rows={1} 
                        onKeyDown={(e) => { 
                            if (isLoading) return;
                            const isMobile = window.innerWidth < 768;
                            if (e.key === 'Enter' && !e.shiftKey) { 
                                if (e.nativeEvent.isComposing) return; 
                                if (!isMobile) { 
                                    e.preventDefault(); 
                                    handleSendMessage(); 
                                } 
                            }
                        }} 
                        aria-label="채팅 입력"
                    />
                </div>
                
                {/* Right Send Button Container */}
                <div className="shrink-0 h-11 flex items-end">
                    <Button 
                        onClick={handleSendMessage} 
                        disabled={(!inputValue.trim() && !attachedImage) || isLoading} 
                        size="icon"
                        variant={isDirectEntryMode ? 'primary' : 'primary'}
                        className={`h-11 w-11 box-border ${isDirectEntryMode ? 'bg-blue-600 text-white' : ''}`}
                        aria-label="메시지 전송"
                    >
                        {isDirectEntryMode ? (
                            <SendHorizontal size={18} strokeWidth={2.5} />
                        ) : (
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 10.5 12 3m0 0 7.5 7.5M12 3v18" /></svg>
                        )}
                    </Button>
                </div>
            </div>
            {isDirectEntryMode && (
                <div className="max-w-3xl mx-auto">
                    <p className="text-center text-[10px] text-blue-500 mt-2 uppercase tracking-widest font-bold animate-pulse">
                        Narrative Import Mode Active
                    </p>
                </div>
            )}
        </footer>
    );
};
