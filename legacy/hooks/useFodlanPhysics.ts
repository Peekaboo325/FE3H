
import { useState, useCallback } from 'react';
import {
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragStartEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  sortableKeyboardCoordinates,
} from '@dnd-kit/sortable';

/**
 * [Fodlan Physics - Snappy Edition]
 * 불필요한 지연시간을 제거하여 기민한 반응성을 복구합니다.
 */
export const useFodlanPhysics = <T extends { stableId?: string; id?: string }>(
  items: T[],
  onUpdate: (newItems: T[]) => void
) => {
  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5, // 최소한의 움직임으로 즉각 반응
      },
    }),
    useSensor(MouseSensor, {
        activationConstraint: {
          distance: 5,
        },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 0, // 지연 시간 삭제
        tolerance: 5,
      },
    }),
    useSensor(KeyboardSensor, { 
      coordinateGetter: sortableKeyboardCoordinates 
    })
  );

  const getEntryId = (item: T): string => {
    if (!item) return "";
    return (item.stableId || item.id || "").toString();
  };

  const handleDragStart = useCallback((event: DragStartEvent) => {
    if (event.active && event.active.id) {
      setActiveId(event.active.id.toString());
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
          try { navigator.vibrate(5); } catch (e) {}
      }
    }
  }, []);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || !active || active.id === over.id || !items) {
      setActiveId(null);
      return;
    }

    const activeIdStr = active.id.toString();
    const overIdStr = over.id.toString();

    const oldIndex = items.findIndex((item) => getEntryId(item) === activeIdStr);
    const newIndex = items.findIndex((item) => getEntryId(item) === overIdStr);

    if (oldIndex !== -1 && newIndex !== -1) {
      const newItems = arrayMove(items, oldIndex, newIndex);
      onUpdate(newItems);
    }
    setActiveId(null);
  }, [items, onUpdate]);

  return {
    activeId,
    sensors,
    handleDragStart,
    handleDragEnd,
    isDragging: !!activeId
  };
};
