
import React, { useState, useEffect } from 'react';
import { AppMode, CharacterProfile } from '../../types/index';
import { ThumbnailPlaceholder } from '../SharedComponents';
import { IconButton } from '../ui/IconButton';

// --- System Menu Modal ---
interface SystemMenuModalProps {
  isOpen: boolean;
  onClose: () => void;
  onExport: () => void;
  onExportText: () => void;
  onImport: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onResetRequest: () => void;
}

export const SystemMenuModal: React.FC<SystemMenuModalProps> = ({ isOpen, onClose, onExport, onExportText, onImport, onResetRequest }) => {
  if (!isOpen) return null;
  
  const buttonBaseClass = "w-full py-4 border transition-all font-bold uppercase text-xs tracking-widest flex items-center justify-center gap-2 rounded-sm";
  const defaultButtonClass = "border-gray-200 dark:border-gray-700 hover:border-blue-500 hover:text-blue-500 dark:text-gray-300 dark:hover:text-blue-400 bg-white dark:bg-transparent";
  const dangerButtonClass = "border-red-200 dark:border-red-900/30 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20";

  return (
     <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
        
        <div className="relative bg-white dark:bg-gray-900 w-full max-w-sm border border-gray-200 dark:border-gray-800 shadow-2xl animate-in zoom-in duration-300 rounded-sm overflow-hidden">
           
           {/* Header: Centered Title + Right Close Button */}
           <div className="h-14 flex items-center justify-center border-b border-gray-100 dark:border-gray-800 relative bg-gray-50/50 dark:bg-gray-900">
               <h3 className="text-xs font-bold uppercase tracking-[0.3em] text-gray-500">SYSTEM</h3>
               <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    <IconButton onClick={onClose} title="닫기">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                        </svg>
                    </IconButton>
               </div>
           </div>

           {/* Content: Grouped Actions */}
           <div className="p-6 space-y-6">
              
              {/* Group A: Preservation (Save/Load/Text) */}
              <div className="space-y-3">
                  <button onClick={onExport} className={`${buttonBaseClass} ${defaultButtonClass}`}>
                      기록 보존
                  </button>
                  <label className={`${buttonBaseClass} ${defaultButtonClass} cursor-pointer relative overflow-hidden`}>
                      기록 복원
                      <input 
                        type="file" 
                        className="absolute inset-0 opacity-0 cursor-pointer w-full h-full" 
                        accept=".json" 
                        onChange={onImport} 
                      />
                  </label>
                  <button onClick={onExportText} className={`${buttonBaseClass} ${defaultButtonClass}`}>
                      기록 사본 출력
                  </button>
              </div>

              {/* Divider */}
              <div className="relative py-2">
                  <div className="absolute inset-0 flex items-center" aria-hidden="true">
                      <div className="w-full border-t border-gray-100 dark:border-gray-800"></div>
                  </div>
                  <div className="relative flex justify-center">
                      <span className="bg-white dark:bg-gray-900 px-2 text-[9px] text-gray-400 uppercase tracking-widest">Danger Zone</span>
                  </div>
              </div>

              {/* Group B: Destruction (Reset) */}
              <div>
                  <button onClick={onResetRequest} className={`${buttonBaseClass} ${dangerButtonClass}`}>
                      기록 초기화
                  </button>
              </div>

           </div>
        </div>
     </div>
  );
};

// --- Reset Confirm Modal ---
interface ResetConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (options: { resetStory: boolean; resetCharacters: boolean; resetCompendium: boolean; resetSettings: boolean; }) => void;
}

export const ResetConfirmModal: React.FC<ResetConfirmModalProps> = ({ isOpen, onClose, onConfirm }) => {
  const [options, setOptions] = useState({
    resetStory: true,
    resetCharacters: false,
    resetCompendium: false,
    resetSettings: false
  });

  useEffect(() => {
    if (isOpen) {
      setOptions({ resetStory: true, resetCharacters: false, resetCompendium: false, resetSettings: false });
    }
  }, [isOpen]);

  const toggle = (key: keyof typeof options) => {
    setOptions(prev => ({ ...prev, [key]: !prev[key] }));
  };

  if (!isOpen) return null;

  return (
     <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={onClose} />
        <div className="relative bg-white dark:bg-gray-900 w-full max-w-md border border-gray-200 dark:border-gray-800 shadow-2xl p-8 animate-in zoom-in duration-300 rounded-sm">
           <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100 mb-6 uppercase tracking-widest text-center">기록 초기화 옵션</h3>
           
           <div className="space-y-4 mb-8">
             <div onClick={() => toggle('resetStory')} className={`flex items-start gap-3 p-4 border rounded cursor-pointer transition-all ${options.resetStory ? 'border-red-500 bg-red-50 dark:bg-red-900/10' : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800'}`}>
                <div className={`mt-0.5 w-4 h-4 border rounded flex items-center justify-center ${options.resetStory ? 'bg-red-500 border-red-500' : 'border-gray-400'}`}>
                    {options.resetStory && <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                </div>
                <div>
                    <span className={`block text-xs font-bold uppercase tracking-widest ${options.resetStory ? 'text-red-600 dark:text-red-400' : 'text-gray-700 dark:text-gray-300'}`}>서사 및 모든 기억 소각</span>
                    <p className="text-[10px] text-gray-500 mt-1 leading-relaxed">대화, 연대기, 그리고 AI의 '잠재적 기억(Memory DB)'을 모두 삭제합니다.<br/>새로운 국면을 시작할 때 필수적인 절차입니다.</p>
                </div>
             </div>

             <div onClick={() => toggle('resetCharacters')} className={`flex items-start gap-3 p-4 border rounded cursor-pointer transition-all ${options.resetCharacters ? 'border-red-500 bg-red-50 dark:bg-red-900/10' : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800'}`}>
                <div className={`mt-0.5 w-4 h-4 border rounded flex items-center justify-center ${options.resetCharacters ? 'bg-red-500 border-red-500' : 'border-gray-400'}`}>
                    {options.resetCharacters && <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                </div>
                <div>
                    <span className={`block text-xs font-bold uppercase tracking-widest ${options.resetCharacters ? 'text-red-600 dark:text-red-400' : 'text-gray-700 dark:text-gray-300'}`}>유닛 목록 완전 소각</span>
                    <p className="text-[10px] text-gray-500 mt-1 leading-relaxed">유저가 등록한 유닛의 프로필을 영구 삭제합니다.</p>
                </div>
             </div>

             <div onClick={() => toggle('resetCompendium')} className={`flex items-start gap-3 p-4 border rounded cursor-pointer transition-all ${options.resetCompendium ? 'border-red-500 bg-red-50 dark:bg-red-900/10' : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800'}`}>
                <div className={`mt-0.5 w-4 h-4 border rounded flex items-center justify-center ${options.resetCompendium ? 'bg-red-500 border-red-500' : 'border-gray-400'}`}>
                    {options.resetCompendium && <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>}
                </div>
                <div>
                    <span className={`block text-xs font-bold uppercase tracking-widest ${options.resetCompendium ? 'text-red-600 dark:text-red-400' : 'text-gray-700 dark:text-gray-300'}`}>견문록 완전 소각</span>
                    <p className="text-[10px] text-gray-500 mt-1 leading-relaxed">유저가 집필한 대륙 견문록의 모든 설정을 영구 삭제합니다.</p>
                </div>
             </div>

             <div onClick={() => toggle('resetSettings')} className={`flex items-start gap-3 p-4 border rounded cursor-pointer transition-all ${options.resetSettings ? 'border-red-500 bg-red-50 dark:bg-red-900/10' : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800'}`}>
                <div className={`mt-0.5 w-4 h-4 border rounded flex items-center justify-center ${options.resetSettings ? 'bg-red-500 border-red-500' : 'border-gray-400'}`}>
                    {options.resetSettings && <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>}
                </div>
                <div>
                    <span className={`block text-xs font-bold uppercase tracking-widest ${options.resetSettings ? 'text-red-600 dark:text-red-400' : 'text-gray-700 dark:text-gray-300'}`}>지도 완전 방침 소각</span>
                    <p className="text-[10px] text-gray-500 mt-1 leading-relaxed">프롬프트 설정 등을 기본값으로 되돌립니다.</p>
                </div>
             </div>
           </div>

           <div className="flex gap-3">
              <button onClick={onClose} className="flex-1 py-3 bg-gray-100 dark:bg-gray-800 font-bold uppercase text-[10px] hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors text-gray-600 dark:text-gray-400 tracking-widest rounded-sm">취소</button>
              <button 
                onClick={() => onConfirm(options)} 
                disabled={!options.resetStory && !options.resetCharacters && !options.resetCompendium && !options.resetSettings}
                className="flex-1 py-3 bg-red-600 text-white font-bold uppercase text-[10px] hover:bg-red-700 shadow-lg transition-colors tracking-widest disabled:opacity-50 disabled:cursor-not-allowed rounded-sm"
              >
                실행
              </button>
           </div>
        </div>
     </div>
  );
};
