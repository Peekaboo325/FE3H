
import React from 'react';
import { CharacterProfile, CharacterAnalysis, CharacterStatsComments } from '../../types/index';
import { RadarChart, StatBar, SkeletonBase } from '../SharedComponents';
import { sanitizeHashtag } from '../../utils/hashtagUtils';

interface AnalysisStatsProps {
  character: CharacterProfile;
  analysis?: CharacterAnalysis;
  isLoading?: boolean;
}

export const AnalysisStats: React.FC<AnalysisStatsProps> = React.memo(({ character, analysis, isLoading }) => {
  // isLoading is now precisely 'isAnalyzingStandard' from parent
  const isActuallyLoading = isLoading || !analysis || Object.values(analysis.stats).every(v => v === 0);
  const safeStats = analysis?.stats || { prowess: 0, magic: 0, faith: 0, intellect: 0, influence: 0, status: 0, wealth: 0, charm: 0, resilience: 0 };
  const safeComments: Partial<CharacterStatsComments> = analysis?.stat_comments || {};
  
  const nameSizeClass = character.name.length > 12 
    ? 'text-lg tracking-tighter' 
    : character.name.length > 8 
      ? 'text-xl tracking-tight' 
      : 'text-2xl tracking-tight';

  return (
    <div className="flex flex-col items-center text-center animate-in fade-in duration-500">
      <div className="w-32 h-32 rounded-full overflow-hidden border-4 border-gray-100 dark:border-gray-800 shadow-lg mb-5 shrink-0 relative group">
        {character.thumbnail ? (
          <img 
            src={character.thumbnail} 
            className={`w-full h-full object-cover ${character.life_status === 'deceased' ? 'grayscale contrast-125' : ''}`} 
            alt={character.name}
          />
        ) : (
          <div className="w-full h-full bg-gray-200 dark:bg-gray-800 flex items-center justify-center text-gray-400 font-bold text-4xl">?</div>
        )}
        {character.life_status === 'deceased' && <div className="absolute inset-0 border-4 border-red-500/30 rounded-full" />}
      </div>

      <h2 className={`${nameSizeClass} font-bold mb-1 whitespace-nowrap overflow-hidden text-ellipsis max-w-full px-1 ${character.life_status === 'deceased' ? 'line-through decoration-red-500/50' : ''}`}>
        {character.name}
      </h2>
      
      <div className="text-xs text-gray-400 uppercase tracking-widest font-medium mb-3">
        {isActuallyLoading ? <SkeletonBase width="100px" height="0.75rem" className="mx-auto" /> : (analysis?.title || '분석 완료')}
      </div>

      <div className="flex flex-wrap justify-center gap-1.5 mb-6 min-h-[22px]">
        {isActuallyLoading ? (
            <>
                <SkeletonBase width="50px" height="18px" />
                <SkeletonBase width="70px" height="18px" />
                <SkeletonBase width="45px" height="18px" />
            </>
        ) : (
            analysis?.hashtags?.map((tag, i) => (
                <span key={i} className="px-2 py-0.5 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 text-[10px] font-bold rounded-sm border border-blue-100 dark:border-blue-800 animate-in zoom-in duration-300">
                    #{sanitizeHashtag(tag)}
                </span>
            ))
        )}
      </div>

      <div className="w-full max-w-sm space-y-6">
        <div className="w-full aspect-square w-[280px] md:max-w-[200px] mx-auto">
          <RadarChart stats={safeStats} isDark={true} isLoading={isActuallyLoading} />
        </div>
        <div className="w-full space-y-3 px-2">
          {(['prowess', 'magic', 'faith', 'intellect', 'influence', 'status', 'wealth', 'charm', 'resilience'] as const).map(key => {
              const labelMap = { prowess: '무력', magic: '마력', faith: '신앙', intellect: '지성', influence: '권세', status: '위상', wealth: '재력', charm: '매력', resilience: '정신' };
              return (
                  <StatBar 
                    key={key}
                    label={labelMap[key]} 
                    value={safeStats[key]} 
                    comment={safeComments[key]} 
                    isLoading={isActuallyLoading}
                  />
              );
          })}
        </div>
      </div>
    </div>
  );
});
