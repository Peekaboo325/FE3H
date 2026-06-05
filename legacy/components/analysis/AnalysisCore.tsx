
import React from 'react';
import { CharacterAnalysis } from '../../types/index';
import { MarkdownContent, SkeletonBase } from '../SharedComponents';

interface AnalysisCoreProps {
  analysis?: CharacterAnalysis;
  isLoading?: boolean;
}

const CoreSkeletonBlock: React.FC = () => (
    <div className="space-y-4 animate-in fade-in duration-500">
        <SkeletonBase width="40%" height="1.25rem" className="mb-6" />
        <SkeletonBase width="100%" height="0.875rem" />
        <SkeletonBase width="95%" height="0.875rem" />
        <SkeletonBase width="98%" height="0.875rem" />
        <SkeletonBase width="60%" height="0.875rem" />
    </div>
);

const ReputationSkeleton: React.FC = () => (
    <div className="space-y-6 animate-in fade-in duration-500">
        <SkeletonBase width="30%" height="1.25rem" className="mb-6" />
        {[1, 2, 3].map(i => (
            <div key={i} className="pl-4 border-l-2 border-gray-100 dark:border-gray-800 space-y-2">
                <SkeletonBase width="60px" height="10px" />
                <SkeletonBase width="85%" height="14px" />
            </div>
        ))}
    </div>
);

export const AnalysisCore: React.FC<AnalysisCoreProps> = React.memo(({ analysis, isLoading }) => {
  const showSkeleton = isLoading || !analysis || !analysis.personality_analysis;

  return (
    <div className="max-w-3xl mx-auto space-y-12 pb-10">
      {/* Personality Analysis Section */}
      <div className="relative">
        <h3 className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-[0.2em] mb-6 pb-2 border-b border-gray-100 dark:border-gray-800">
          Personality Analysis
        </h3>
        {showSkeleton ? (
            <CoreSkeletonBlock />
        ) : (
            <div className="text-sm leading-8 text-gray-800 dark:text-gray-200 font-sans text-justify animate-in fade-in duration-700">
                <MarkdownContent content={analysis.personality_analysis} variant="compact" />
            </div>
        )}
      </div>

      {/* Unconscious Nature Section */}
      <div className="relative">
        <h3 className="text-xs font-bold text-orange-600 dark:text-orange-400 uppercase tracking-[0.2em] mb-6 pb-2 border-b border-gray-100 dark:border-gray-800">
          Unconscious Nature
        </h3>
        {showSkeleton ? (
            <CoreSkeletonBlock />
        ) : (
            <div className="text-sm leading-8 font-sans text-justify [&_p]:text-gray-500 [&_p]:dark:text-gray-500 animate-in fade-in duration-700">
                <MarkdownContent content={analysis.unconscious_analysis} variant="compact" />
            </div>
        )}
      </div>

      {/* Reputation Section */}
      <div className="relative">
        <h3 className="text-xs font-bold text-purple-600 dark:text-purple-400 uppercase tracking-[0.2em] mb-6 pb-2 border-b border-gray-100 dark:border-gray-800">
          Reputation & Rumors
        </h3>
        {showSkeleton ? (
            <ReputationSkeleton />
        ) : (
            <div className="space-y-6 animate-in fade-in duration-700">
                {analysis.reputation?.map((item, i) => (
                    <div key={i} className="pl-4 border-l-2 border-gray-200 dark:border-gray-700 transition-colors">
                        <div className="mb-1">
                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{item.source}</span>
                        </div>
                        {/* [PO's SPEC] font-medium 제거하여 텍스트를 더 가늘게 표현 */}
                        <p className="text-sm text-gray-800 dark:text-gray-200 font-normal leading-relaxed">
                            "{item.comment}"
                        </p>
                    </div>
                ))}
            </div>
        )}
      </div>
    </div>
  );
});
