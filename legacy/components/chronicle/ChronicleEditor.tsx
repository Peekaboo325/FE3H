
import React, { useState } from 'react';
import { ChronicleEntry, DialogueItem, StateChangeItem } from '../../types/index';
import { SectionHeader } from '../ui/SectionHeader';
import { IconButton } from '../ui/IconButton';
import { DeleteButton } from '../ui/DeleteButton';

interface ChronicleEditorProps {
    initialData: ChronicleEntry;
    onSave: (data: ChronicleEntry) => void;
    onCancel: () => void;
    onDelete: (id: string) => void;
    isProcessing: boolean;
    onClose: () => void;
}

export const ChronicleEditor: React.FC<ChronicleEditorProps> = ({
    initialData,
    onSave,
    onCancel,
    onDelete,
    isProcessing,
    onClose
}) => {
    // Utility helpers for list formatting
    const formatList = (list: string[] | undefined) => 
        (!list || list.length === 0) ? '' : list.map(item => item.startsWith('- ') ? item : `- ${item}`).join('\n');
    
    const parseList = (text: string) => 
        text.split('\n').map(line => line.replace(/^[-*•]\s*/, '').trim()).filter(Boolean);

    // Local Form State
    const [editForm, setEditForm] = useState<ChronicleEntry>({
        ...initialData,
        major_dialogues: (initialData.major_dialogues || []).filter(d => d.line && d.line.trim().length > 0),
        state_changes: initialData.state_changes || [],
        tags: initialData.tags || { person: [], place: [], topic: [], item: [], sentiment: [] }
    });
    const [seedsInput, setSeedsInput] = useState(formatList(initialData.seeds));
    const [eventsInput, setEventsInput] = useState(formatList(initialData.key_events));

    // [PR #UX-1.1] Local string state for tags to prevent cursor jumping and space issues
    const [tagInputs, setTagInputs] = useState({
        person: initialData.tags?.person?.join(', ') || '',
        place: initialData.tags?.place?.join(', ') || '',
        topic: initialData.tags?.topic?.join(', ') || '',
        item: initialData.tags?.item?.join(', ') || '',
        sentiment: initialData.tags?.sentiment?.join(', ') || ''
    });

    const handleInternalSave = (e: React.MouseEvent) => {
        e.stopPropagation();
        
        // Parse tags from local string state
        const parsedTags = {
            person: tagInputs.person.split(',').map(s => s.trim()).filter(Boolean),
            place: tagInputs.place.split(',').map(s => s.trim()).filter(Boolean),
            topic: tagInputs.topic.split(',').map(s => s.trim()).filter(Boolean),
            item: tagInputs.item.split(',').map(s => s.trim()).filter(Boolean),
            sentiment: tagInputs.sentiment.split(',').map(s => s.trim()).filter(Boolean)
        };

        const cleanForm: ChronicleEntry = { 
            ...editForm, 
            seeds: parseList(seedsInput), 
            key_events: parseList(eventsInput), 
            keywords: editForm.keywords?.filter(s => s.trim() !== '') || [], 
            major_dialogues: editForm.major_dialogues?.filter(d => d.speaker.trim() && d.line.trim()) || [], 
            state_changes: editForm.state_changes?.filter(s => s.content.trim()) || [],
            tags: parsedTags as any
        };
        onSave(cleanForm);
    };

    // Form Handlers
    const addDialogueRow = () => setEditForm(prev => ({ ...prev, major_dialogues: [...(prev.major_dialogues || []), { speaker: '', line: '' }] }));
    const removeDialogueRow = (idx: number) => setEditForm(prev => ({ ...prev, major_dialogues: (prev.major_dialogues || []).filter((_, i) => i !== idx) }));
    const updateDialogue = (idx: number, field: keyof DialogueItem, val: string) => setEditForm(prev => {
        const next = [...(prev.major_dialogues || [])];
        next[idx] = { ...next[idx], [field]: val };
        return { ...prev, major_dialogues: next };
    });

    const addStateRow = () => setEditForm(prev => ({ ...prev, state_changes: [...(prev.state_changes || []), { category: '정보', content: '' }] }));
    const removeStateRow = (idx: number) => setEditForm(prev => ({ ...prev, state_changes: (prev.state_changes || []).filter((_, i) => i !== idx) }));
    const updateState = (idx: number, field: keyof StateChangeItem, val: string) => setEditForm(prev => {
        const next = [...(prev.state_changes || [])];
        next[idx] = { ...next[idx], [field]: val };
        return { ...prev, state_changes: next };
    });

    const updateTags = (category: string, val: string) => {
        setTagInputs(prev => ({ ...prev, [category]: val }));
    };

    // Styling Constants
    const inputBaseClass = "w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-sm px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all outline-none dark:text-gray-200 placeholder-gray-400 font-sans";
    const labelClass = "text-[10px] font-bold text-gray-400 uppercase block mb-1.5 tracking-wider";

    return (
        <>
            <SectionHeader 
                title="기록 편집" 
                onClose={onClose} 
                leftContent={
                    <div className="md:hidden">
                        <IconButton onClick={onCancel} title="목록으로">
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" /></svg>
                        </IconButton>
                    </div>
                } 
            />
            <div className="flex-1 overflow-y-auto custom-scrollbar p-6 md:p-10">
                <div className="max-w-3xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300 pb-20">
                    <div>
                        <label className={labelClass}>연대기 제목</label>
                        <input value={editForm.title} onChange={e => setEditForm({...editForm, title: e.target.value})} className={inputBaseClass} placeholder="제목을 입력하세요" />
                    </div>
                    
                    <div>
                        <label className={labelClass}>줄거리 요약</label>
                        <textarea value={editForm.summary} onChange={e => setEditForm({...editForm, summary: e.target.value})} className={`${inputBaseClass} h-48 resize-none leading-relaxed custom-scrollbar`} />
                    </div>
                    
                    <div>
                        <div className="flex items-center justify-between mb-2">
                            <label className={labelClass}>상태 변화</label>
                            <button onClick={addStateRow} className="text-[10px] text-blue-500 font-bold hover:underline">+ 추가</button>
                        </div>
                        <div className="space-y-2">
                            {editForm.state_changes?.map((s, idx) => (
                                <div key={idx} className="flex gap-2 items-center">
                                    <input value={s.category} onChange={e => updateState(idx, 'category', e.target.value)} placeholder="분류" maxLength={2} className={`${inputBaseClass} w-16 shrink-0 text-center`} />
                                    <input value={s.content} onChange={e => updateState(idx, 'content', e.target.value)} placeholder="변화 내용" className={inputBaseClass} />
                                    <button onClick={() => removeStateRow(idx)} className="p-2 text-gray-400 hover:text-red-500">
                                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" /></svg>
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                    
                    <div>
                        <label className={labelClass}>사건 로그</label>
                        <textarea value={eventsInput} onChange={e => setEventsInput(e.target.value)} className={`${inputBaseClass} h-32 resize-none leading-relaxed`} />
                    </div>
                    
                    <div>
                        <div className="flex items-center justify-between mb-2">
                            <label className={labelClass}>주요 대사</label>
                            <button onClick={addDialogueRow} className="text-[10px] text-blue-500 font-bold hover:underline">+ 추가</button>
                        </div>
                        <div className="space-y-2">
                            {editForm.major_dialogues?.map((d, idx) => (
                                <div key={idx} className="flex gap-2 items-start">
                                    <input value={d.speaker} onChange={e => updateDialogue(idx, 'speaker', e.target.value)} placeholder="화자" className={`${inputBaseClass} w-24 shrink-0`} />
                                    <input value={d.line} onChange={e => updateDialogue(idx, 'line', e.target.value)} placeholder="대사 내용" className={inputBaseClass} />
                                    <button onClick={() => removeDialogueRow(idx)} className="p-2 text-gray-400 hover:text-red-500">
                                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" /></svg>
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                    
                    <div>
                        <label className={labelClass}>미스터리</label>
                        <textarea value={seedsInput} onChange={e => setSeedsInput(e.target.value)} className={`${inputBaseClass} h-32 resize-none leading-relaxed`} />
                    </div>
                    
                    <div>
                        <label className={labelClass}>키워드 태그 (쉼표로 구분)</label>
                        <div className="space-y-3 bg-gray-50 dark:bg-gray-800/50 p-4 rounded">
                            <div className="flex items-center gap-2">
                                <span className="text-[10px] font-bold text-gray-500 w-12 shrink-0">인물</span>
                                <input value={tagInputs.person} onChange={e => updateTags('person', e.target.value)} className={inputBaseClass} />
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="text-[10px] font-bold text-gray-500 w-12 shrink-0">장소</span>
                                <input value={tagInputs.place} onChange={e => updateTags('place', e.target.value)} className={inputBaseClass} />
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="text-[10px] font-bold text-gray-500 w-12 shrink-0">주제</span>
                                <input value={tagInputs.topic} onChange={e => updateTags('topic', e.target.value)} className={inputBaseClass} />
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="text-[10px] font-bold text-gray-500 w-12 shrink-0">물품</span>
                                <input value={tagInputs.item} onChange={e => updateTags('item', e.target.value)} className={inputBaseClass} />
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="text-[10px] font-bold text-gray-500 w-12 shrink-0">정서</span>
                                <input value={tagInputs.sentiment} onChange={e => updateTags('sentiment', e.target.value)} className={inputBaseClass} />
                            </div>
                        </div>
                    </div>

                    <div className="pt-4 space-y-6">
                        <div className="flex gap-4 border-t border-gray-100 dark:border-gray-800 pt-6">
                            <button 
                                onClick={(e) => { e.stopPropagation(); onCancel(); }} 
                                className="flex-1 py-3 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-500 font-bold uppercase text-[10px] tracking-widest rounded-sm transition-colors"
                            >
                                작성 취소
                            </button>
                            <button 
                                onClick={handleInternalSave} 
                                disabled={isProcessing}
                                className="flex-1 py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold uppercase text-[10px] tracking-widest rounded-sm transition-all shadow-lg active:scale-95 disabled:opacity-50"
                            >
                                편찬 완료
                            </button>
                        </div>
                        <div className="flex justify-end pb-4">
                            <DeleteButton onConfirm={() => onDelete(initialData.id)} disabled={isProcessing} title="연대기 영구 삭제" className="text-gray-400 hover:text-red-500" />
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
};
