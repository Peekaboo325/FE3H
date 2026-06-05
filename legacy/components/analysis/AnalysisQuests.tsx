
import React from 'react';
import { QuestItem, QuestType } from '../../types/index';
import { SkeletonBase } from '../SharedComponents';

interface AnalysisQuestsProps {
  quests?: QuestItem[];
  isGlobalLoading: boolean;
}

const QUEST_MAP: Record<QuestType, { label: string; colorClass: string; textClass: string; borderClass: string }> = {
  'Duty': { label: '의무', colorClass: 'bg-blue-50 dark:bg-blue-900/20', textClass: 'text-blue-600 dark:text-blue-300', borderClass: 'border-blue-200 dark:border-blue-800' },
  'Ambition': { label: '야망', colorClass: 'bg-rose-50 dark:bg-rose-900/20', textClass: 'text-rose-600 dark:text-rose-300', borderClass: 'border-rose-200 dark:border-rose-800' },
  'Social': { label: '교류', colorClass: 'bg-emerald-50 dark:bg-emerald-900/20', textClass: 'text-emerald-600 dark:text-emerald-300', borderClass: 'border-emerald-200 dark:border-emerald-800' },
  'Leisure': { label: '휴식', colorClass: 'bg-amber-50 dark:bg-amber-900/20', textClass: 'text-amber-600 dark:text-amber-300', borderClass: 'border-amber-200 dark:border-amber-800' },
  'Unexpected': { label: '돌발', colorClass: 'bg-purple-50 dark:bg-purple-900/20', textClass: 'text-purple-600 dark:text-purple-300', borderClass: 'border-purple-200 dark:border-purple-800' }
};

const QuestSkeletonCard: React.FC = () => (
    <div className="bg-white dark:bg-[#18181b] p-6 md:p-7 rounded-lg border border-gray-100 dark:border-gray-800 space-y-4 animate-in fade-in duration-500">
        <div className="flex items-center gap-3">
            <SkeletonBase width="40px" height="18px" />
            <SkeletonBase width="60%" height="1.25rem" />
        </div>
        <div className="space-y-2">
            <SkeletonBase width="100%" height="0.875rem" />
            <SkeletonBase width="40%" height="0.875rem" />
        </div>
        <div className="w-full h-px bg-gray-100 dark:bg-gray-800" />
        <div className="flex justify-between items-center">
            <SkeletonBase width="30px" height="10px" />
            <SkeletonBase width="120px" height="10px" />
        </div>
    </div>
);

const QuestCard: React.FC<{ quest: QuestItem }> = React.memo(({ quest }) => {
  const style = QUEST_MAP[quest.type] || QUEST_MAP['Unexpected'];
  return (
    <div className="bg-white dark:bg-[#18181b] p-6 md:p-7 rounded-lg border border-gray-100 dark:border-gray-800 transition-colors shadow-sm animate-in fade-in slide-in-from-top-2 duration-500">
      <div className="flex items-center gap-3 mb-3">
        <span className={`px-2 py-1 rounded-sm text-[10px] font-bold uppercase tracking-wider border ${style.colorClass} ${style.textClass} ${style.borderClass} shrink-0`}>
          {style.label}
        </span>
        <h4 className="text-lg font-bold text-gray-900 dark:text-gray-100 tracking-tight leading-snug">{quest.name}</h4>
      </div>
      <div className="mb-5">
        <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed font-sans italic opacity-90">"{quest.description}"</p>
      </div>
      <div className="w-full h-px bg-gray-100 dark:bg-gray-800 mb-3" />
      <div className="flex items-center gap-4 text-xs">
        <span className="text-gray-400 font-bold uppercase tracking-widest shrink-0">보상</span>
        <span className="text-gray-600 dark:text-gray-400 font-bold break-keep text-right ml-auto">{quest.reward}</span>
      </div>
    </div>
  );
});

export const AnalysisQuests: React.FC<AnalysisQuestsProps> = React.memo(({ quests, isGlobalLoading }) => {
  if (isGlobalLoading) {
      return (
          <div className="max-w-3xl mx-auto space-y-6 pb-10">
              {[1, 2, 3].map(i => <QuestSkeletonCard key={i} />)}
          </div>
      );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-10">
      {(!quests || quests.length === 0) ? (
        <div className="text-center py-20 text-gray-400 text-xs font-sans tracking-wide bg-gray-50/50 dark:bg-gray-800/30 rounded-lg border border-dashed border-gray-200 dark:border-gray-800 animate-in fade-in duration-700">
          현재 확인 가능한 임무가 없습니다.
        </div>
      ) : (
        quests.map((quest, i) => (
          <QuestCard key={i} quest={quest} />
        ))
      )}
    </div>
  );
});
