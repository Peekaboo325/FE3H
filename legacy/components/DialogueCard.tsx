import React from 'react';
import { ThumbnailPlaceholder } from './SharedComponents';
import { useAppStore } from '../store/useAppStore';
import { extractFirstName } from '../utils/textUtils';

interface DialogueCardProps {
  speakerName: string;
  content: string;
  withQuotes?: boolean;
  className?: string;
}

/**
 * [v4.6.3: DialogueCard Component]
 * A visual card representing a character's voice or relationship record.
 * [Update] shadow-inner 제거 및 테두리 정제로 평면적 룩 완성.
 */
export const DialogueCard: React.FC<DialogueCardProps> = ({ 
  speakerName, 
  content, 
  withQuotes = false,
  className = ""
}) => {
  const { characters } = useAppStore();

  // [v4.6.1] Hard Guard: Do not render if content is empty or only whitespace
  if (!content || !content.trim()) {
      return null;
  }

  // Find matching character based on First Name or Aliases
  const matchedChar = characters.find(c => {
      const charFirstName = extractFirstName(c.name);
      const isNameMatch = charFirstName === speakerName;
      const isAliasMatch = c.aliases?.some(alias => extractFirstName(alias) === speakerName);
      return isNameMatch || isAliasMatch;
  });

  // Smart Font Scaling for Names
  const nameLen = speakerName.length;
  const nameSizeClass = nameLen > 5 
    ? "text-[9px] tracking-tighter" 
    : "text-[10px] tracking-tight";

  return (
    <div className={`flex items-center gap-4 py-4 px-5 bg-white dark:bg-[#161618] border border-gray-100 dark:border-gray-800 rounded-lg group animate-in fade-in duration-300 ${className}`}>
      
      {/* [Portrait & Name Group] */}
      <div className="flex flex-col items-center shrink-0 w-16 gap-2">
          <div className="w-12 h-12 rounded-full overflow-hidden border border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 relative">
              {matchedChar?.thumbnail ? (
                  <img src={matchedChar.thumbnail} alt={speakerName} className="w-full h-full object-cover" />
              ) : (
                  <ThumbnailPlaceholder />
              )}
          </div>
          <span className={`font-bold text-gray-400 dark:text-gray-500 uppercase text-center w-full truncate ${nameSizeClass}`}>
              {speakerName}
          </span>
      </div>

      {/* [Dialogue Content] */}
      <div className="flex-1 min-w-0">
          <p className="text-sm text-gray-800 dark:text-gray-200 font-normal leading-relaxed font-sans break-keep selection:bg-blue-100 dark:selection:bg-blue-900/30">
              {withQuotes && <span className="text-gray-300 dark:text-gray-600 mr-0.5 select-none">“</span>}
              {content}
              {withQuotes && <span className="text-gray-300 dark:text-gray-600 ml-0.5 select-none">”</span>}
          </p>
      </div>
    </div>
  );
};