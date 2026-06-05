
import React from 'react';
import { createPortal } from 'react-dom';
import { BelongingItem } from '../../types/index';
import {
  DndContext, 
  closestCenter,
  DragOverlay,
} from '@dnd-kit/core';
import {
  SortableContext,
  rectSortingStrategy
} from '@dnd-kit/sortable';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { SkeletonBase } from '../SharedComponents';
import { useFodlanPhysics } from '../../hooks/useFodlanPhysics';

interface AnalysisItemsProps {
  belongings: BelongingItem[];
  isManageMode: boolean;
  selectedItemIds: Set<string>;
  isGlobalLoading: boolean;
  isExploringItems: boolean;
  onToggleSelect: (id: string) => void;
  onItemClick: (id: string) => void;
  onExplore: () => void;
  onUpdateBelongings: (newBelongings: BelongingItem[]) => void;
}

const ItemSkeletonCard: React.FC = () => (
    <div className="flex flex-col items-center text-center p-6 rounded-lg border border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-[#151518]/50 min-h-[180px] justify-center space-y-4 animate-in fade-in duration-500">
        <SkeletonBase width="48px" height="48px" circle />
        <SkeletonBase width="60%" height="14px" />
        <div className="w-6 h-px bg-gray-200 dark:bg-gray-700" />
        <SkeletonBase width="80%" height="10px" />
    </div>
);

interface SortableItemProps { 
  id: string; 
  item: BelongingItem; 
  isManageMode: boolean; 
  isSelected: boolean; 
  onToggleSelect: () => void;
  onItemClick: () => void; 
}

const SortableItem: React.FC<SortableItemProps> = React.memo(({ 
  id, item, isManageMode, isSelected, onToggleSelect, onItemClick 
}) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ 
    id, 
    disabled: isManageMode 
  });
  
  const style = { 
    transform: transform ? CSS.Transform.toString(transform) : undefined, 
    transition, 
    zIndex: isDragging ? 50 : 'auto', 
    opacity: isDragging ? 0.2 : 1,
    touchAction: 'manipulation'
  };

  return (
    <div 
      ref={setNodeRef} 
      style={style} 
      {...attributes}
      {...listeners} 
      onClick={isManageMode ? onToggleSelect : onItemClick} 
      className={`group relative flex flex-col items-center text-center p-6 rounded-lg border select-none min-h-[180px] justify-center touch-none transition-[border-color,background-color,opacity,box-shadow] duration-300 ${
        isManageMode 
          ? (isSelected ? 'border-red-500 bg-red-50 dark:bg-red-900/20 ring-1 ring-red-500 cursor-pointer' : 'border-gray-200 dark:border-gray-800 bg-white dark:bg-[#18181b] hover:border-gray-400 dark:hover:border-gray-600 cursor-pointer opacity-70') 
          : 'border-gray-200 dark:border-gray-800 bg-white dark:bg-[#18181b] cursor-pointer'
      }`}
    >
      <div className={isDragging ? 'invisible' : ''}>
        {item.isNew && !isManageMode && <span className="absolute top-3 left-3 bg-blue-600 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-sm z-10 tracking-widest shadow-sm animate-bounce">NEW</span>}
        {!isManageMode && (
          <div className="absolute top-3 right-3 p-1.5 text-gray-200 dark:text-gray-700 pointer-events-none" title="꾹 눌러서 이동">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" /></svg>
          </div>
        )}
        {isManageMode && (
          <div className={`absolute top-3 right-3 w-5 h-5 rounded-full border flex items-center justify-center transition-colors ${isSelected ? 'bg-red-500 border-red-500' : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800'}`}>
            {isSelected && <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3 text-white"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>}
          </div>
        )}
        <div className="text-4xl mb-4 filter drop-shadow-sm pointer-events-none transition-transform duration-500 group-hover:scale-110">{item.emoji}</div>
        <h4 className="text-sm font-bold text-gray-900 dark:text-gray-100 tracking-tight pointer-events-none break-keep whitespace-pre-wrap w-full leading-snug">{item.name}</h4>
        <div className="w-6 h-px bg-gray-200 dark:bg-gray-700 my-3 pointer-events-none mx-auto" />
        <p className="text-[11px] text-gray-500 dark:text-gray-400 leading-relaxed font-sans break-keep whitespace-pre-wrap pointer-events-none w-full px-2 opacity-80 transition-opacity">{item.comment}</p>
      </div>
    </div>
  );
});

const DragOverlayItem: React.FC<{ item: BelongingItem }> = ({ item }) => (
  <div className="flex flex-col items-center text-center p-6 rounded-lg border border-blue-500 bg-white dark:bg-[#202024] shadow-2xl scale-105 cursor-grabbing min-h-[180px] justify-center opacity-95">
    <div className="text-4xl mb-4 filter drop-shadow-sm">{item.emoji}</div>
    <h4 className="text-sm font-bold text-gray-900 dark:text-gray-100 tracking-tight break-keep whitespace-pre-wrap w-full leading-snug">{item.name}</h4>
    <div className="w-6 h-px bg-gray-200 dark:bg-gray-700 my-3 mx-auto" />
    <p className="text-[11px] text-gray-500 dark:text-gray-400 leading-relaxed font-sans break-keep whitespace-pre-wrap w-full px-2">{item.comment}</p>
  </div>
);

const ExplorationCard: React.FC<{ onClick: () => void; isLoading: boolean; isDisabled: boolean }> = React.memo(({ onClick, isLoading, isDisabled }) => (
  <div 
    onClick={!isLoading && !isDisabled ? onClick : undefined} 
    className={`group relative flex flex-col items-center justify-center text-center p-6 rounded-lg border border-dashed transition-all duration-300 select-none min-h-[180px] ${
      isLoading 
        ? 'border-blue-500 bg-blue-50/20 dark:bg-blue-900/10 cursor-wait animate-pulse' 
        : isDisabled 
          ? 'border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-[#151518]/50 opacity-50 cursor-not-allowed' 
          : 'border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-[#151518] hover:border-blue-400 dark:hover:border-blue-500 hover:bg-white dark:hover:bg-[#1a1a1d] cursor-pointer'
    }`}
  >
    <div className={`w-12 h-12 rounded-full flex items-center justify-center mb-3 transition-all duration-300 ${isLoading ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-600' : (isDisabled ? 'bg-gray-200 dark:bg-gray-800 text-gray-400' : 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 group-hover:scale-110 group-hover:bg-blue-100 dark:group-hover:bg-blue-800/50')}`}>
      {isLoading ? (
        <svg className="animate-spin w-6 h-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
      ) : (
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
      )}
    </div>
    <h4 className={`text-xs font-bold uppercase tracking-widest transition-colors ${isLoading ? 'text-blue-600 dark:text-blue-400' : (isDisabled ? 'text-gray-400' : 'text-gray-400 group-hover:text-blue-600 dark:group-hover:text-blue-400')}`}>
      {isLoading ? '궤적 추적 중' : '서사 탐색'}
    </h4>
  </div>
));

export const AnalysisItems: React.FC<AnalysisItemsProps> = React.memo(({ 
  belongings, isManageMode, selectedItemIds, isGlobalLoading, isExploringItems, 
  onToggleSelect, onItemClick, onExplore, onUpdateBelongings 
}) => {
  
  const { activeId, sensors, handleDragStart, handleDragEnd } = useFodlanPhysics(
    belongings, 
    onUpdateBelongings
  );

  return (
    <div className="max-w-4xl mx-auto animate-in fade-in duration-500 pb-20">
      <DndContext 
        sensors={sensors} 
        collisionDetection={closestCenter} 
        onDragStart={handleDragStart} 
        onDragEnd={handleDragEnd}
      >
        <SortableContext 
          items={belongings?.map((item) => item.stableId.toString()) || []} 
          strategy={rectSortingStrategy}
        >
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
            {isExploringItems && (
                <>
                    <ItemSkeletonCard />
                    <ItemSkeletonCard />
                    <ItemSkeletonCard />
                </>
            )}
            
            {belongings?.map((item) => (
              <SortableItem 
                key={item.stableId} 
                id={item.stableId} 
                item={item} 
                isManageMode={isManageMode} 
                isSelected={selectedItemIds.has(item.stableId)} 
                onToggleSelect={() => onToggleSelect(item.stableId)} 
                onItemClick={() => onItemClick(item.stableId)} 
              />
            ))}
            
            {!isManageMode && (
              <ExplorationCard 
                onClick={onExplore} 
                isLoading={isExploringItems} 
                isDisabled={isGlobalLoading && !isExploringItems} 
              />
            )}
          </div>
        </SortableContext>
        
        {createPortal(
          <DragOverlay 
            dropAnimation={null}
          >
            {activeId && belongings ? (
              <DragOverlayItem item={belongings.find(b => b.stableId.toString() === activeId.toString())!} />
            ) : null}
          </DragOverlay>,
          document.body
        )}
      </DndContext>
    </div>
  );
});
