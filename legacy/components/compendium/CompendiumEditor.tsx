
import React, { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
// [Fix] Updated import path to use types/index to avoid deprecated root types file
import { CompendiumEntry, CompendiumSection } from '../../types/index';
import { SectionHeader } from '../ui/SectionHeader';
import { IconButton } from '../ui/IconButton';
import { DeleteButton } from '../ui/DeleteButton';
import { geminiService } from '../../services/geminiService';
import { generateId } from '../../utils/textUtils';
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

interface SortableSection extends CompendiumSection {
  stableId: string;
}

interface CompendiumEditorProps {
  initialData: CompendiumEntry;
  onSave: (data: CompendiumEntry) => void;
  onCancel: () => void;
  onDelete: (id: string) => void;
  onClose: () => void;
  onBack: () => void;
}

/**
 * [UI Component: SortableSectionItem]
 * Surgical Fix: 상단 바 영역에만 드래그 리스너를 부여하여 텍스트 선택 간섭을 차단합니다.
 */
const SortableSectionItem: React.FC<{
    section: SortableSection;
    isRefining: boolean;
    onUpdate: (field: keyof CompendiumSection, val: string) => void;
    onRemove: () => void;
    onRefine: () => void;
}> = ({ section, isRefining, onUpdate, onRemove, onRefine }) => {
    const { 
        attributes, listeners, setNodeRef, transform, transition, isDragging 
    } = useSortable({ id: section.stableId });

    const style = {
        transform: transform ? CSS.Transform.toString(transform) : undefined,
        transition,
        opacity: isDragging ? 0.3 : 1,
        zIndex: isDragging ? 50 : 'auto',
    };

    const inputBaseClass = "w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-sm px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all outline-none dark:text-gray-200 font-sans";

    return (
        <div 
            ref={setNodeRef}
            style={style}
            className={`relative border border-gray-100 dark:border-gray-800 bg-white dark:bg-[#1c1c1f]/40 overflow-hidden shadow-sm animate-in fade-in duration-300 ${isDragging ? 'z-50' : ''}`}
        >
            {/* [Surgical Handle Layer] 오직 이 영역을 통해서만 드래그 가능 */}
            <div 
                {...attributes} 
                {...listeners}
                className="h-8 bg-gray-50 dark:bg-black/40 flex items-center justify-between px-3 cursor-grab active:cursor-grabbing border-b border-gray-100 dark:border-gray-800 group/handle"
                title="상단 바를 잡아 드래그하십시오"
            >
                <div className="flex items-center gap-2">
                    <div className="flex flex-col gap-0.5 opacity-20 group-hover/handle:opacity-50 transition-opacity">
                        <div className="flex gap-0.5"><div className="w-0.5 h-0.5 rounded-full bg-current"/><div className="w-0.5 h-0.5 rounded-full bg-current"/><div className="w-0.5 h-0.5 rounded-full bg-current"/></div>
                        <div className="flex gap-0.5"><div className="w-0.5 h-0.5 rounded-full bg-current"/><div className="w-0.5 h-0.5 rounded-full bg-current"/><div className="w-0.5 h-0.5 rounded-full bg-current"/></div>
                    </div>
                    <span className="text-[9px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-[0.2em] select-none">소주제</span>
                </div>
                
                <button 
                    onPointerDown={e => e.stopPropagation()}
                    onClick={(e) => { e.stopPropagation(); onRemove(); }} 
                    className="text-gray-300 hover:text-red-500 p-1 transition-colors"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-3 h-3"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" /></svg>
                </button>
            </div>

            {/* [Protected Content Layer] 드래그 리스너가 없어 텍스트 블록 지정이 방해받지 않음 */}
            <div className="p-5 space-y-4">
                <input 
                    value={section.subtitle} 
                    onChange={e => onUpdate('subtitle', e.target.value)} 
                    className={inputBaseClass}
                    placeholder="소주제 제목 입력" 
                />
                <div className="relative">
                    <textarea 
                        value={section.content} 
                        onChange={e => onUpdate('content', e.target.value)} 
                        className={`${inputBaseClass} h-40 resize-none leading-relaxed custom-scrollbar pb-10`} 
                        placeholder="기록 내용을 입력하세요..."
                    />
                    <div className="absolute bottom-3 right-3">
                        <button 
                            onClick={(e) => { e.stopPropagation(); onRefine(); }} 
                            disabled={!section.content.trim() || isRefining}
                            className={`flex items-center gap-1.5 px-2 py-1 rounded-sm border bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm text-[9px] font-bold uppercase transition-all shadow-sm ${isRefining ? 'text-blue-500 border-blue-200 dark:border-blue-900 animate-pulse' : 'text-gray-400 border-gray-200 dark:border-gray-700 hover:text-blue-500 hover:border-blue-300'}`}
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className={`w-3 h-3 ${isRefining ? 'animate-spin' : ''}`}><path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.456-2.454L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.454 2.456L21.75 6l-1.035.259a3.375 3.375 0 0 0-2.456 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 0 0-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 0 0 1.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 0 0 1.423 1.423l1.183.394-1.183.394a2.25 2.25 0 0 0-1.423 1.423z" /></svg>
                            {isRefining ? '정제 중' : '문장 정제'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export const CompendiumEditor: React.FC<CompendiumEditorProps> = ({
  initialData,
  onSave,
  onCancel,
  onDelete,
  onClose,
  onBack
}) => {
  const [title, setTitle] = useState(initialData.title);
  const [sections, setSections] = useState<SortableSection[]>(
    initialData.sections.map(s => ({ ...s, stableId: generateId() }))
  );
  const [isRefining, setIsRefining] = useState<Record<string, boolean>>({});

  const labelClass = "text-[10px] font-bold text-gray-400 uppercase block mb-1.5 tracking-wider";

  const { activeId, sensors, handleDragStart, handleDragEnd } = useFodlanPhysics(
    sections,
    (newSections) => setSections(newSections)
  );

  const addSection = () => setSections(prev => [...prev, { subtitle: "", content: "", stableId: generateId() }]);
  const removeSection = (stableId: string) => setSections(prev => prev.filter(s => s.stableId !== stableId));
  const updateSection = (stableId: string, field: keyof CompendiumSection, val: string) => setSections(prev => 
    prev.map(s => s.stableId === stableId ? { ...s, [field]: val } : s)
  );

  const handleRefine = async (stableId: string) => {
    const section = sections.find(s => s.stableId === stableId);
    if (!section || !section.content.trim() || isRefining[stableId]) return;
    setIsRefining(prev => ({ ...prev, [stableId]: true }));
    try {
        const refined = await geminiService.refineCompendiumText(section.content);
        updateSection(stableId, 'content', refined);
    } catch (e) {
        console.error(e);
    } finally {
        setIsRefining(prev => ({ ...prev, [stableId]: false }));
    }
  };

  const handleSave = () => {
    const finalSections = sections.map(({ stableId, ...rest }) => rest);
    onSave({ ...initialData, title, sections: finalSections });
  };

  const activeDragSection = useMemo(() => sections.find(s => s.stableId === activeId), [sections, activeId]);

  return (
    <>
      <SectionHeader 
        title="기록 편집" 
        onClose={onClose} 
        leftContent={
            <div className="md:hidden">
                <IconButton onClick={onBack} title="목록으로">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" /></svg>
                </IconButton>
            </div>
        }
      />
      <div className="flex-1 overflow-y-auto custom-scrollbar p-6 md:p-10">
        <div className="max-w-3xl mx-auto space-y-6 pb-20 animate-in fade-in slide-in-from-bottom-2 duration-300">
          
          <div>
            <label className={labelClass}>대주제</label>
            <input 
              value={title} 
              onChange={e => setTitle(e.target.value)} 
              className="w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-sm px-3 h-10 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all outline-none dark:text-gray-200 font-sans" 
              placeholder="대주제 제목"
            />
          </div>

          <DndContext 
            sensors={sensors} 
            collisionDetection={closestCenter} 
            onDragStart={handleDragStart} 
            onDragEnd={handleDragEnd}
          >
            <SortableContext 
                items={sections.map(s => s.stableId)} 
                strategy={verticalListSortingStrategy}
            >
                <div className="space-y-4">
                    {sections.map((s) => (
                        <SortableSectionItem 
                            key={s.stableId}
                            section={s}
                            isRefining={!!isRefining[s.stableId]}
                            onUpdate={(field, val) => updateSection(s.stableId, field, val)}
                            onRemove={() => removeSection(s.stableId)}
                            onRefine={() => handleRefine(s.stableId)}
                        />
                    ))}
                </div>
            </SortableContext>

            {createPortal(
                <DragOverlay dropAnimation={null}>
                    {activeDragSection ? (
                        <div className="bg-white dark:bg-[#1c1c1f] border border-blue-500 shadow-2xl opacity-90 scale-105 cursor-grabbing rounded-sm overflow-hidden">
                             <div className="h-8 bg-blue-500 flex items-center px-3">
                                <span className="text-[9px] font-bold text-white uppercase tracking-[0.2em]">이동 중</span>
                            </div>
                            <div className="p-5">
                                <h4 className="text-sm font-bold text-gray-900 dark:text-gray-100">{activeDragSection.subtitle || "(제목 없음)"}</h4>
                            </div>
                        </div>
                    ) : null}
                </DragOverlay>,
                document.body
            )}
          </DndContext>

          <div className="flex justify-center pt-4">
              <button 
                  onClick={addSection}
                  className="px-6 py-3 border border-blue-200 dark:border-blue-900 text-blue-600 dark:text-blue-400 text-[11px] font-bold uppercase tracking-widest hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all shadow-sm active:scale-95 rounded-sm"
              >
                  소주제 추가하기
              </button>
          </div>

          <div className="pt-4 space-y-6">
            <div className="flex gap-4 border-t border-gray-100 dark:border-gray-800 pt-6">
                <button 
                    onClick={onCancel} 
                    className="flex-1 py-3 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-500 font-bold uppercase text-[10px] tracking-widest rounded-sm transition-colors"
                >
                    작성 취소
                </button>
                <button 
                    onClick={handleSave} 
                    disabled={!title.trim()}
                    className="flex-1 py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold uppercase text-[10px] tracking-widest rounded-sm transition-all shadow-lg active:scale-95 disabled:opacity-30"
                >
                    편찬 완료
                </button>
            </div>
            <div className="flex justify-end pb-4">
                <DeleteButton 
                    onConfirm={() => onDelete(initialData.id)} 
                    title="항목 영구 삭제" 
                    className="text-gray-400 hover:text-red-500" 
                />
            </div>
          </div>
        </div>
      </div>
    </>
  );
};