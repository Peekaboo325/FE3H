
import React from 'react';
import { Library } from 'lucide-react';

interface ChronicleActionDockProps {
  selectionCount: number;
  onCancel: () => void;
  onCompile: () => void;
  onViewArchives: () => void;
  isProcessing: boolean;
}

const ChronicleActionDock: React.FC<ChronicleActionDockProps> = ({ 
  selectionCount, onCancel, onCompile, onViewArchives, isProcessing 
}) => {
  return (
    <div className="w-full max-w-3xl mx-auto p-4 animate-in slide-in-from-bottom-6 duration-300">
      <div className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-xl border border-blue-100 dark:border-blue-900 shadow-2xl rounded-2xl p-3 md:p-4 flex items-center justify-between gap-2 md:gap-4">
        
        {/* Info Area */}
        <div className="flex-1">
            <h3 className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-widest mb-1">
                편찬 모드
            </h3>
            <p className="text-[10px] text-gray-500 dark:text-gray-400">
                {selectionCount > 0 
                    ? `${selectionCount}개의 기록이 선택되었습니다.` 
                    : "기록의 시작점과 끝점을 선택하십시오."}
            </p>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1.5 md:gap-2">
            <button 
                onClick={onViewArchives}
                title="기록 열람"
                className="flex items-center justify-center p-2 md:px-4 md:py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-600 dark:text-gray-300 text-xs font-bold uppercase tracking-widest rounded-lg transition-colors"
            >
                <Library className="w-4 h-4 md:mr-2" />
                <span className="hidden md:inline">기록 열람</span>
            </button>
            <button 
                onClick={onCancel}
                className="px-3 py-2 md:px-4 bg-gray-100 dark:bg-gray-700 hover:bg-red-50 dark:hover:bg-red-900/20 text-gray-600 dark:text-gray-300 hover:text-red-500 dark:hover:text-red-400 text-xs font-bold uppercase tracking-widest rounded-lg transition-colors"
            >
                취소
            </button>
            <button 
                onClick={onCompile}
                disabled={selectionCount === 0 || isProcessing}
                className="px-4 py-2 md:px-6 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold uppercase tracking-widest rounded-lg shadow-lg hover:shadow-blue-500/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
                {isProcessing ? (
                    <>
                        <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        집필 중
                    </>
                ) : (
                    <>
                        집필하기
                    </>
                )}
            </button>
        </div>
      </div>
    </div>
  );
};

export default ChronicleActionDock;
