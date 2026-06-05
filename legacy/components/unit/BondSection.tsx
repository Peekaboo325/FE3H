import React, { useMemo } from 'react';
import { createPortal } from 'react-dom';
import { BondRecord, CharacterProfile } from '../../types/index';
import { BondCard } from './BondCard';
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

const SortableBondItem: React.FC<{
    bond: BondRecord;
    characters: CharacterProfile[];
}> = ({ bond, characters }) => {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: bond.id });
    const style = { 
        transform: transform ? CSS.Transform.toString(transform) : undefined, 
        transition, 
        zIndex: isDragging ? 50 : 'auto',
        opacity: isDragging ? 0.3 : 1
    };

    return (
        <div 
            ref={setNodeRef} 
            style={style} 
            {...attributes} 
            {...listeners} 
            className={`relative group/sortable border-b border-gray-100 dark:border-gray-800 cursor-grab active:cursor-grabbing transition-colors ${isDragging ? 'z-50' : ''}`}
        >
            <BondCard bond={bond} characters={characters} isDragging={isDragging} />
        </div>
    );
};

export const BondSection: React.FC<BondSectionProps> = ({ bonds, characters, onReorder }) => {
    // [PO's PROTOCOL] 데이터가 아예 없는 항목은 뷰 모드(Dossier)에서 완전히 배제
    const visibleBonds = useMemo(() => {
        return (bonds || []).filter(b => b.name?.trim() || b.description?.trim());
    }, [bonds]);

    const { activeId, sensors, handleDragStart, handleDragEnd } = useFodlanPhysics(
        visibleBonds,
        onReorder
    );

    const activeBond = visibleBonds.find(b => b.id === activeId);

    if (visibleBonds.length === 0) return null;

    return (
        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-500">
            <div className="flex items-center gap-3 border-b border-gray-100 dark:border-gray-800 pb-2">
                <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest font-sans">BOUND RECORDS</h3>
            </div>

            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
                <SortableContext items={visibleBonds.map(b => b.id)} strategy={verticalListSortingStrategy}>
                    <div className="grid grid-cols-1 border-t border-gray-100 dark:border-gray-800">
                        {visibleBonds.map(bond => (
                            <SortableBondItem key={bond.id} bond={bond} characters={characters} />
                        ))}
                    </div>
                </SortableContext>

                {createPortal(
                    <DragOverlay dropAnimation={null}>
                        {activeBond ? (
                            <div className="border border-blue-500 bg-white dark:bg-[#121214] shadow-2xl scale-105 opacity-95 cursor-grabbing">
                                <BondCard bond={activeBond} characters={characters} />
                            </div>
                        ) : null}
                    </DragOverlay>,
                    document.body
                )}
            </DndContext>
        </div>
    );
};

interface BondSectionProps {
  bonds: BondRecord[];
  characters: CharacterProfile[];
  onReorder: (newBonds: BondRecord[]) => void;
}