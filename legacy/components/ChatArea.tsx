import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import MessageBubble from './MessageBubble';
import { AutoResizeTextarea, LoadingIndicator } from './SharedComponents';
import { cleanTextForCopy } from '../utils/textUtils';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useAppStore } from '../store/useAppStore';
import { useShallow } from 'zustand/react/shallow';
import { IconButton } from './ui/IconButton';
import { Badge } from './ui/Badge';
import * as selectors from '../store/selectors';
import { AppRefs } from '../store/types';

interface ChatAreaProps {
    refs: AppRefs;
}

export const ChatArea: React.FC<ChatAreaProps> = ({ refs }) => {
    // [Fix] Corrected useShallow usage to wrap the selector for proper typing and performance. 
    // This fixes "Expected 0-1 arguments, but got 2" and subsequent "type unknown" errors.
    const visibleMessages = useAppStore(
        useShallow(state => state.messages.filter(m => !m.isHidden))
    );
    
    // Original messages array needed for range calculations
    const messages = useAppStore(state => state.messages); 
    
    const { isChronicleMode, selectionStartId, selectionEndId } = useAppStore(
        useShallow(selectors.selectChronicleSelection)
    );
    
    const { editingMessageId, editingContent, regeneratingMessageId, jumpToMessageId } = useAppStore(
        useShallow(selectors.selectChatMeta)
    );

    const isLoading = useAppStore(selectors.selectIsLoading);
    const isRecallActive = useAppStore(selectors.selectIsRecallActive);
    const inputValue = useAppStore(selectors.selectInputValue);
    const isInputFocused = useAppStore(selectors.selectIsInputFocused);

    const { 
        setEditingMessageId, setEditingContent, setJumpToMessageId,
        handleToggleSelection, handleSaveEdit, handleStartEdit,
        handleRegenerateResponse, handleDeleteMessage
    } = useAppStore();

    const [copiedId, setCopiedId] = useState<string | null>(null);
    const [zoomedImage, setZoomedImage] = useState<string | null>(null);
    const parentRef = refs.scrollContainerRef;

    const rowVirtualizer = useVirtualizer({
        count: visibleMessages.length,
        getScrollElement: () => parentRef.current,
        estimateSize: () => 150,
        overscan: 5,
    });

    const lastMessageCountRef = useRef(visibleMessages.length);
    useEffect(() => {
        const container = parentRef.current;
        if (!container) return;
        const currentCount = visibleMessages.length;
        const prevCount = lastMessageCountRef.current;
        if (currentCount > prevCount) {
            const lastMessage = visibleMessages[currentCount - 1];
            const isUserMessage = lastMessage?.role === 'user';
            const { scrollTop, scrollHeight, clientHeight } = container;
            const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
            const isNearBottom = distanceFromBottom < 300;
            if (isUserMessage || isNearBottom) {
                setTimeout(() => { rowVirtualizer.scrollToIndex(currentCount - 1, { align: 'end' }); }, 50);
            }
        }
        lastMessageCountRef.current = currentCount;
    }, [visibleMessages.length, rowVirtualizer]);

    useEffect(() => {
        if (jumpToMessageId) {
            const index = visibleMessages.findIndex(m => m.id === jumpToMessageId);
            if (index !== -1) {
                setTimeout(() => {
                    rowVirtualizer.scrollToIndex(index, { align: 'center' });
                    const el = document.getElementById(`message-${jumpToMessageId}`);
                    if (el) {
                        el.classList.add('ring-2', 'ring-blue-500', 'ring-offset-4', 'duration-500', 'transition-all');
                        setTimeout(() => { el.classList.remove('ring-2', 'ring-blue-500', 'ring-offset-4'); }, 1000);
                    }
                }, 100);
            }
            setJumpToMessageId(null);
        }
    }, [jumpToMessageId, visibleMessages, rowVirtualizer, setJumpToMessageId]);

    const isMessageInRange = (msgId: string) => {
        if (!selectionStartId || !selectionEndId) return false;
        const startIdx = messages.findIndex(m => m.id === selectionStartId);
        const endIdx = messages.findIndex(m => m.id === selectionEndId);
        const currentIdx = messages.findIndex(m => m.id === msgId);
        if (startIdx === -1 || endIdx === -1 || currentIdx === -1) return false;
        return currentIdx > startIdx && currentIdx < endIdx;
    };

    const handleCopyMessage = (id: string, content: string) => {
        const cleanText = cleanTextForCopy(content);
        navigator.clipboard.writeText(cleanText);
        setCopiedId(id);
        setTimeout(() => setCopiedId(null), 2000);
    };

    return (
        <>
            <main ref={parentRef} className="flex-1 overflow-y-auto bg-white dark:bg-gray-900 custom-scrollbar scroll-pt-24 pb-32 w-full relative" style={{ contain: 'strict' }}>
                <div className="max-w-2xl mx-auto relative" style={{ height: `${rowVirtualizer.getTotalSize()}px`, width: '100%' }}>
                    {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                        const msg = visibleMessages[virtualRow.index];
                        if (!msg) return null;
                        const isUser = msg.role === 'user';
                        const isEditing = editingMessageId === msg.id;
                        const isRegenerating = regeneratingMessageId === msg.id;
                        const isSelected = isChronicleMode && (msg.id === selectionStartId || msg.id === selectionEndId);
                        const selectionType = msg.id === selectionStartId ? 'start' : msg.id === selectionEndId ? 'end' : null;
                        const isInRange = isChronicleMode && !isUser && isMessageInRange(msg.id);
                        const isUserDisabledInChronicle = isChronicleMode && isUser;
                        let label = isUser ? '' : '<SYSTEM>';

                        return (
                            <div key={virtualRow.key} ref={rowVirtualizer.measureElement} data-index={virtualRow.index} className="absolute top-0 left-0 w-full px-6" style={{ transform: `translateY(${virtualRow.start}px)` }}>
                                <div id={`message-${msg.id}`} className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} py-6 group`}>
                                    {!isUser && (<Badge variant="ghost" className="mb-1.5 px-1">{label}</Badge>)}
                                    {msg.image && (
                                        <div className="max-w-sm w-auto mb-3 overflow-hidden rounded-lg shadow-md border border-gray-200 dark:border-gray-700 cursor-zoom-in hover:brightness-95 transition-all" onClick={() => setZoomedImage(msg.image || null)}>
                                            <img src={msg.image} className="w-full h-auto object-contain" alt="attachment" />
                                        </div>
                                    )}
                                    <div className={`relative max-w-[95%] text-sm leading-relaxed border transition-all duration-200 ${isSelected ? 'ring-2 ring-offset-2 ring-blue-500 dark:ring-blue-400 z-10' : ''} ${isInRange ? 'ring-1 ring-blue-200 dark:ring-blue-900 bg-blue-50/30 dark:bg-blue-900/10' : ''} ${isEditing ? 'w-full border-blue-500 ring-1 ring-blue-500 bg-white dark:bg-gray-800 rounded-none p-6' : isUser ? 'bg-gray-50 dark:bg-gray-800 border-gray-100 dark:border-gray-700 rounded-none px-6 py-4 text-gray-800 dark:text-gray-200' : 'bg-white dark:bg-gray-900 border-gray-100 dark:border-gray-800 shadow-sm rounded-none p-6 text-gray-800 dark:text-gray-200'} ${isUserDisabledInChronicle ? 'opacity-30 grayscale pointer-events-none select-none blur-[0.5px]' : ''}`}>
                                        {isEditing ? (
                                            <AutoResizeTextarea value={editingContent || ''} onChange={setEditingContent} onSave={() => handleSaveEdit(msg.id)} onCancel={() => { setEditingMessageId(null); setEditingContent(''); }} />
                                        ) : isRegenerating ? (
                                            <LoadingIndicator isRecallActive={isRecallActive} />
                                        ) : (
                                            <MessageBubble message={msg} isChronicleMode={isChronicleMode} isSelected={isSelected} isInRange={isInRange} selectionType={selectionType} onSelect={handleToggleSelection} />
                                        )}
                                    </div>
                                    {!isEditing && !isLoading && !isChronicleMode && !isRegenerating && (
                                        <div className={`flex items-center gap-1 mt-2 px-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
                                            {!isUser && (
                                                <>
                                                    <IconButton onClick={() => handleCopyMessage(msg.id, msg.content)} title="내용 복사" className="rounded-full">
                                                        {copiedId === msg.id ? (<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-3.5 h-3.5 text-green-500"><path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" /></svg>) : (<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-3.5 h-3.5"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 0 1-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 0 1 1.5.124m7.5 10.376h3.375c.621 0 1.125-.504 1.125-1.125V11.25c0-4.46-3.243-8.161-7.5-8.876a9.06 9.06 0 0 0-1.5-.124H9.375c-.621 0-1.125.504-1.125 1.125v3.5m7.5 10.375H9.375a1.125 1.125 0 0 1-1.125-1.125v-9.25m12 6.625v-1.875a3.375 3.375 0 0 0-3.375-3.375h-1.5" /></svg>)}
                                                    </IconButton>
                                                    <div className="w-px h-3 bg-gray-200 dark:bg-gray-700 mx-1"></div>
                                                </>
                                            )}
                                            {!isUser && (
                                                <IconButton onClick={() => handleRegenerateResponse(msg.id)} title="다시 생성" className="rounded-full">
                                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" /></svg>
                                                </IconButton>
                                            )}
                                            <IconButton onClick={() => handleStartEdit(msg)} title="수정" className="rounded-full"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" /></svg></IconButton>
                                            <IconButton onClick={() => handleDeleteMessage(msg.id)} variant="danger" title="삭제" className="rounded-full"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" /></svg></IconButton>
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                    {isLoading && !regeneratingMessageId && (
                        <div className="absolute left-0 w-full px-6 transition-all" style={{ top: `${rowVirtualizer.getTotalSize()}px` }}>
                            <div className="flex flex-col items-start py-6 animate-in fade-in slide-in-from-bottom-2 duration-300 group">
                                <Badge variant="ghost" className="mb-1.5 px-1">{'<SYSTEM>'}</Badge>
                                <div className="bg-white dark:bg-gray-900 border-gray-100 dark:border-gray-800 shadow-sm rounded-none p-6 text-gray-800 dark:text-gray-200">
                                    <LoadingIndicator isRecallActive={isRecallActive} />
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </main>
            {(!isInputFocused && !inputValue.trim()) && (
                <button onClick={() => rowVirtualizer.scrollToIndex(visibleMessages.length - 1, { align: 'end' })} className="fixed bottom-24 right-6 z-50 p-3 bg-white dark:bg-gray-800 text-blue-500 hover:bg-blue-50 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-700 rounded-full shadow-xl transition-all animate-in fade-in duration-300 group hover:scale-110" title="최신 대화로 이동">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-5 h-5 group-hover:translate-y-0.5 transition-transform"><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 13.5 12 21m0 0-7.5-7.5M12 21V3" /></svg>
                </button>
            )}
            {zoomedImage && createPortal(
                <div className="fixed inset-0 z-[100] bg-black/95 flex items-center justify-center p-4 animate-in fade-in duration-200" onClick={() => setZoomedImage(null)}>
                    <img src={zoomedImage} className="max-w-full max-h-full object-contain shadow-2xl rounded-sm" alt="Zoomed" />
                    <button className="absolute top-6 right-6 text-white/50 hover:text-white p-2" onClick={() => setZoomedImage(null)}>
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-8 h-8"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" /></svg>
                    </button>
                </div>, document.body
            )}
        </>
    );
};
