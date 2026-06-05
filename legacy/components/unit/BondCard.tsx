
import React from 'react';
import { BondRecord, CharacterProfile } from '../../types/index';
import { ThumbnailPlaceholder } from '../SharedComponents';
import { extractFirstName } from '../../utils/textUtils';
import { getThemeStyles } from '../../services/bondLogic';

interface BondCardProps {
  bond: BondRecord;
  characters: CharacterProfile[];
  isDragging?: boolean;
}

/**
 * [v4.7.0 BondCard - Status Integration]
 * 인연의 생사 상태(사망, 실종)를 시각적으로 투영합니다.
 */
export const BondCard: React.FC<BondCardProps> = ({ bond, characters, isDragging }) => {
  if (!bond.name?.trim() && !bond.description?.trim()) {
      return null;
  }

  const theme = bond.theme || 'slate';
  const styles = getThemeStyles(theme);
  const status = bond.life_status || 'alive';

  // Portrait matching
  const matchedChar = characters.find(c => {
      const regName = c.name.trim();
      const inputName = bond.name.trim();
      const inputEng = bond.english_name?.trim().toLowerCase();
      const regEng = c.english_name?.trim().toLowerCase();
      
      if (inputEng && regEng && inputEng === regEng) return true;
      if (regName === inputName) return true;
      const firstName = extractFirstName(c.name);
      if (firstName === inputName) return true;
      return c.aliases?.some(a => 
          a.trim() === inputName || 
          extractFirstName(a) === inputName
      );
  });

  const fullName = bond.name || '(무명)';
  const firstName = bond.name ? extractFirstName(bond.name) : '(무명)';
  
  const nameSizeClass = firstName.length > 5 ? 'text-[11px]' : 'text-[12px]';

  // Status-based Style Logic
  const imageFilterClass = 
    status === 'deceased' ? 'grayscale contrast-125' : 
    status === 'unknown' ? 'grayscale brightness-50 blur-[0.5px]' : '';
  
  const nameStyleClass = status === 'deceased' ? 'line-through decoration-red-500/50' : '';

  return (
    <div className={`
        flex flex-col md:flex-row md:items-center gap-5 md:gap-8 py-6 px-0 md:px-6 transition-all bg-white dark:bg-[#161618] border-b border-gray-100 dark:border-gray-800 group
        ${isDragging ? 'opacity-30 scale-95' : ''}
        ${status !== 'alive' ? 'bg-gray-50/30 dark:bg-black/10' : ''}
    `}>
        <div className="flex flex-row md:flex-col items-center shrink-0 w-full md:w-[90px] gap-4 md:gap-3">
            <div className={`w-12 h-12 md:w-14 md:h-14 rounded-full overflow-hidden border border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 relative shrink-0 shadow-sm group-hover:shadow-md transition-shadow`}>
                {matchedChar?.thumbnail ? (
                    <img src={matchedChar.thumbnail} alt={bond.name} className={`w-full h-full object-cover ${imageFilterClass}`} />
                ) : (
                    <div className={`w-full h-full ${imageFilterClass}`}><ThumbnailPlaceholder /></div>
                )}
                {status === 'unknown' && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <span className="text-white/40 text-lg font-bold">?</span>
                    </div>
                )}
                {status === 'deceased' && (
                    <div className="absolute inset-0 border-[3px] border-red-900/10 rounded-full pointer-events-none" />
                )}
            </div>
            
            <div className="flex flex-row md:flex-col items-center md:justify-center gap-2 md:gap-1.5 min-w-0 flex-1 md:flex-none">
                <div className="flex flex-col w-full min-w-0">
                    <span className={`md:hidden font-bold text-gray-800 dark:text-gray-200 text-[12px] text-left leading-tight truncate ${nameStyleClass}`}>
                        {fullName}
                    </span>
                    <span className={`hidden md:block font-bold text-gray-800 dark:text-gray-200 ${nameSizeClass} text-center leading-tight tracking-tighter truncate w-full ${nameStyleClass}`}>
                        {firstName}
                    </span>
                </div>

                <span className={`text-[9px] font-bold py-0.5 rounded-sm uppercase tracking-tighter border shrink-0 text-center w-[46px] transition-colors ${styles.bg} ${styles.text} ${styles.border}`}>
                    {status === 'unknown' ? '행방불명' : (bond.category || '미분류')}
                </span>
            </div>
        </div>

        <div className="flex-1 min-w-0">
            <p className="text-[13px] text-gray-700 dark:text-gray-300 font-normal leading-relaxed font-sans break-keep whitespace-pre-wrap selection:bg-blue-100">
                {bond.description || '관계에 대한 기록이 없습니다.'}
            </p>
        </div>
    </div>
  );
};
