
import React, { useMemo, useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { CharacterProfile } from '../../types/index';
import { SectionHeader } from '../ui/SectionHeader';
import { IconButton } from '../ui/IconButton';
import { ThumbnailPlaceholder, FodlanPortrait } from '../SharedComponents';
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

interface UnitListProps {
  characters: CharacterProfile[];
  editingCharId?: string;
  onSelectChar: (char: CharacterProfile) => void;
  onCreateNew: () => void;
  onMoveChar: (index: number, direction: 'up' | 'down') => void;
  onToggleActive: (e: React.MouseEvent, id: string) => void;
  onReorder?: (newChars: CharacterProfile[]) => void;
}

/**
 * [UI Component: SortableUnitItem]
 * 모바일 최적화: 좌측 50% 드래그 핸들, 우측 50% 스크롤 영역 할당
 */
const SortableUnitItem: React.FC<{
  char: CharacterProfile;
  isSelected: boolean;
  onSelect: () => void;
  onToggleActive: (e: React.MouseEvent) => void;
}> = React.memo(({ char, isSelected, onSelect, onToggleActive }) => {
  const [isMobile, setIsMobile] = useState(false);
  
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const { 
    attributes, listeners, setNodeRef, transform, transition, isDragging 
  } = useSortable({ id: char.id });

  const style = {
    transform: transform ? CSS.Transform.toString(transform) : undefined,
    transition,
    opacity: isDragging ? 0.3 : 1,
    zIndex: isDragging ? 50 : 'auto',
    // 모바일에서는 우측 영역 스크롤을 위해 pan-y 허용
    touchAction: isMobile ? 'pan-y' : 'none'
  };

  const nameLength = char.name?.length || 0;
  const nameFontSizeClass = nameLength >= 19 
    ? 'text-[10px]' 
    : nameLength >= 13 
      ? 'text-[11px]' 
      : 'text-xs';

  return (
    <div 
      ref={setNodeRef}
      style={style}
      // 데스크탑에서는 전체가 드래그 영역, 모바일에서는 내부 핸들 div가 담당
      {...(!isMobile ? attributes : {})}
      {...(!isMobile ? listeners : {})}
      className={`
        group flex items-center gap-3 p-2 px-4 transition-all border border-transparent relative select-none
        ${isSelected ? 'bg-white dark:bg-[#1c1c1f] shadow-sm border-gray-200 dark:border-gray-700' : 'hover:bg-gray-100 dark:hover:bg-[#151518]'}
        ${isDragging ? 'z-50 ring-1 ring-blue-500/20' : ''}
        ${!isMobile ? 'cursor-grab active:cursor-grabbing' : ''}
      `}
    >
      {/* [PO's SPEC] 모바일 전용 좌측 50% 투명 DnD 활성 영역 */}
      {isMobile && (
        <div 
          className="absolute inset-y-0 left-0 w-1/2 z-30 touch-none cursor-grab active:cursor-grabbing"
          {...attributes}
          {...listeners}
          onClick={(e) => { e.stopPropagation(); onSelect(); }}
        />
      )}

      {/* 정보 영역 */}
      <div className="flex-1 flex items-center gap-3 min-w-0 pointer-events-auto" onClick={(e) => { e.stopPropagation(); onSelect(); }}>
        <div 
            className={`
            w-9 h-9 rounded-full bg-gray-200 dark:bg-gray-800 shrink-0 relative transition-all
            ${char.isActive ? '' : 'opacity-60'}
            `}
        >
            <FodlanPortrait 
                src={char.thumbnail} 
                size="full"
                alt={char.name}
                className={`${!char.isActive ? 'grayscale' : ''} ${char.life_status === 'unknown' ? 'grayscale brightness-50' : ''}`}
            />
        </div>

        <div className={`flex-1 min-w-0 transition-opacity ${!char.isActive ? 'opacity-40' : ''}`}>
            <div className="flex items-center gap-1.5 min-w-0">
            <span className={`${nameFontSizeClass} font-bold whitespace-nowrap text-gray-900 dark:text-gray-200 ${char.life_status === 'deceased' ? 'text-red-500 dark:text-red-400 line-through' : ''}`}>
                {char.name}
            </span>
            </div>
            <p className="text-[9px] text-gray-400 truncate mt-0.5">{char.aliases && char.aliases.length > 0 ? char.aliases[0] : ''}</p>
        </div>
      </div>

      <button 
        onClick={(e) => { e.stopPropagation(); onToggleActive(e); }} 
        onPointerDown={e => e.stopPropagation()}
        className={`shrink-0 w-2 h-2 rounded-full border border-white dark:border-gray-800 transition-colors shadow-sm z-40 relative ${char.isActive ? 'bg-green-500' : 'bg-gray-300'}`} 
      />
    </div>
  );
});

const UnitDragOverlay: React.FC<{ char: CharacterProfile }> = ({ char }) => (
  <div className="flex items-center gap-3 p-3 px-5 bg-white dark:bg-[#202024] shadow-2xl border border-blue-500/50 opacity-95 scale-105 cursor-grabbing">
    <div className={`w-9 h-9 rounded-full shrink-0 ${!char.isActive ? 'grayscale opacity-60' : ''}`}>
      <FodlanPortrait src={char.thumbnail} size="full" />
    </div>
    <div className="flex-1 min-w-0">
      <span className="text-xs font-bold whitespace-nowrap text-gray-900 dark:text-gray-100">{char.name}</span>
    </div>
  </div>
);

export const UnitList: React.FC<UnitListProps> = ({
  characters = [],
  editingCharId,
  onSelectChar,
  onCreateNew,
  onToggleActive,
  onReorder
}) => {
  const { activeId, sensors, handleDragStart, handleDragEnd } = useFodlanPhysics(
    characters,
    (newChars) => onReorder?.(newChars)
  );

  const activeChar = useMemo(() => characters.find(c => c.id === activeId), [characters, activeId]);

  return (
    <div className="w-full md:w-72 border-r border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-[#0a0a0b] flex flex-col h-full shrink-0">
      <SectionHeader 
        title="PERSONNEL" 
        rightContent={
          <IconButton onClick={onCreateNew} title="Add Unit">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
          </IconButton>
        }
      />
      
      <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-0.5">
        {characters.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-center opacity-50 p-6 select-none animate-in fade-in duration-700">
            <div className="text-3xl mb-4 grayscale">♟️</div>
            <p className="text-[11px] text-gray-500 dark:text-gray-400 font-bold uppercase tracking-widest break-keep leading-relaxed">
              아직 쓰이지 않은 역사입니다.<br/>첫 문장을 시작하십시오.
            </p>
          </div>
        ) : (
          <DndContext 
            sensors={sensors} 
            collisionDetection={closestCenter} 
            onDragStart={handleDragStart} 
            onDragEnd={handleDragEnd}
          >
            <SortableContext 
              items={characters.map(c => c.id.toString())} 
              strategy={verticalListSortingStrategy}
            >
              <div className="space-y-0.5">
                {characters.map((char) => (
                  <SortableUnitItem 
                    key={char.id} 
                    char={char} 
                    isSelected={editingCharId === char.id} 
                    onSelect={() => onSelectChar(char)} 
                    onToggleActive={(e) => onToggleActive(e, char.id)} 
                  />
                ))}
              </div>
            </SortableContext>

            {createPortal(
              <DragOverlay dropAnimation={null}>
                {activeChar ? <UnitDragOverlay char={activeChar} /> : null}
              </DragOverlay>,
              document.body
            )}
          </DndContext>
        )}
      </div>
    </div>
  );
};
