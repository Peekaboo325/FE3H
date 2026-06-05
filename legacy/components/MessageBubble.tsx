
import React, { useState, useEffect } from 'react';
import { Message } from '../types/index';
import { MarkdownContent } from './SharedComponents';

interface MessageBubbleProps {
  message: Message;
  isChronicleMode?: boolean;
  isSelected?: boolean; // Is specifically start or end marker
  isInRange?: boolean; // Is inside the selection range
  selectionType?: 'start' | 'end' | 'single' | null;
  onSelect?: (id: string) => void;
}

const MessageBubble: React.FC<MessageBubbleProps> = ({ 
  message, isChronicleMode, isSelected, isInRange, selectionType, onSelect 
}) => {
  const [isPurifying, setIsPurifying] = useState(false);

  // [PR #4] Trigger Purification Shimmer on change
  useEffect(() => {
    if (!message.isStreaming) {
      setIsPurifying(true);
      const timer = setTimeout(() => setIsPurifying(false), 1200);
      return () => clearTimeout(timer);
    }
  }, [message.id, message.isStreaming]);

  const handleBubbleClick = () => {
    if (isChronicleMode && onSelect && message.role !== 'user') {
      onSelect(message.id);
    }
  };

  // Chronicle Mode & Selection Styles
  const containerClass = `
    relative w-full transition-all duration-300
    ${isChronicleMode ? 'cursor-pointer' : ''}
    ${isChronicleMode && !isSelected && !isInRange ? 'opacity-50 grayscale' : ''}
  `;

  return (
    <div className="w-full" onClick={handleBubbleClick}>
      <div className={containerClass}>
        
        {/* [PR #4] Purification Shimmer Layer */}
        {isPurifying && <div className="purification-shimmer" />}

        {/* Selection Badge */}
        {isSelected && (
          <div className="absolute -top-5 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-widest shadow-md text-white bg-blue-600 animate-in zoom-in duration-200 z-20">
            {selectionType === 'start' ? '시작' : selectionType === 'end' ? '종료' : '선택됨'}
          </div>
        )}

        {/* Content Render - fallback to text for legacy messages */}
        <div className="prose-custom text-gray-900 dark:text-gray-100">
          <MarkdownContent content={message.content || message.text || ''} />
        </div>

        {/* Streaming Indicator */}
        {message.isStreaming && (
           <span className="inline-block w-2 h-4 align-middle ml-1 bg-current animate-pulse opacity-70" />
        )}
      </div>
    </div>
  );
};

export default MessageBubble;
