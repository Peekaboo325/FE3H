
import React, { useState, useLayoutEffect, useEffect } from 'react';
import { useFodlan } from './hooks/useFodlan';
import { useAppStore } from './store/useAppStore'; 
import { useShallow } from 'zustand/react/shallow';
import { useAppShortcuts } from './hooks/useAppShortcuts';
import { useSystemEffects } from './hooks/useSystemEffects';
import { LoadingIndicator } from './components/SharedComponents';
import { AppModals } from './components/AppModals';
import { AppSidebar } from './components/AppSidebar';
import { AppHeader } from './components/AppHeader';
import { AppFooter } from './components/AppFooter';
import { ChatArea } from './components/ChatArea';
import { assetManager } from './services/system/assetManager';
import * as selectors from './store/selectors';
import { PenTool, SendHorizontal, Plus, X } from 'lucide-react';

const TemporalDistortionOverlay: React.FC<{ isActive: boolean }> = ({ isActive }) => {
    if (!isActive) return null;
    return (
        <div className="fixed inset-0 z-[55] pointer-events-none overflow-hidden select-none" aria-hidden="true">
            <div className="absolute inset-0 animate-temporal-distortion" />
            <div className="absolute inset-0 backdrop-blur-[0.5px] opacity-30" />
        </div>
    );
};

const App: React.FC = () => {
  const { refs, actions: ioActions } = useFodlan();
  useAppShortcuts();
  const { isHeartbeating } = useSystemEffects();
  
  const isInitialized = useAppStore(selectors.selectIsInitialized);
  const period = useAppStore(selectors.selectPeriod);
  const isRecallActive = useAppStore(selectors.selectIsRecallActive);
  const inputValue = useAppStore(selectors.selectInputValue);
  
  const { 
      handleSelectPeriod, setInputValue, setIsInputFocused
  } = useAppStore();

  useLayoutEffect(() => {
    const textarea = refs.mainInputRef.current;
    if (textarea) {
        textarea.style.height = 'auto'; 
        const maxHeight = 160;
        // 최소 높이를 44px로 보정
        const newHeight = Math.max(44, Math.min(textarea.scrollHeight, maxHeight));
        textarea.style.height = `${newHeight}px`;
        textarea.style.overflowY = textarea.scrollHeight > maxHeight ? 'auto' : 'hidden';
    }
  }, [inputValue]);

  if (!isInitialized) {
      return (
          <div className="min-h-screen bg-white dark:bg-gray-950 flex flex-col items-center justify-center" role="status">
              <LoadingIndicator text="기록보관소(Archive) 접속 중..." />
          </div>
      );
  }

  if (!period) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex flex-col items-center justify-center p-6 font-sans">
        <div className="max-w-3xl w-full text-center animate-in fade-in duration-700">
            <h1 className="text-2xl font-bold tracking-[0.4em] uppercase mb-16 text-gray-900 dark:text-gray-100 leading-relaxed md:whitespace-nowrap">
              Fire Emblem : <br className="block md:hidden"/>Three Houses
            </h1>
            <div className="grid md:grid-cols-2 gap-8 px-4">
                <button onClick={() => handleSelectPeriod('part1')} className="group relative border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-12 hover:border-blue-500 hover:shadow-2xl transition-all uppercase tracking-[0.2em] text-xs font-bold text-gray-600 dark:text-gray-400 focus-visible:ring-2 focus-visible:ring-blue-500 outline-none">
                   <div className="absolute inset-0 bg-blue-500/5 opacity-0 group-hover:opacity-100 transition-opacity" />Part I : 1180
                </button>
                <button onClick={() => handleSelectPeriod('part2')} className="group relative border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-12 hover:border-red-500 hover:shadow-2xl transition-all uppercase tracking-[0.2em] text-xs font-bold text-gray-600 dark:text-gray-400 focus-visible:ring-2 focus-visible:ring-red-500 outline-none">
                   <div className="absolute inset-0 bg-red-500/5 opacity-0 group-hover:opacity-100 transition-opacity" />Part II : 1185
                </button>
            </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex h-screen bg-white dark:bg-gray-900 overflow-hidden relative font-sans transition-all duration-500`}>
      <TemporalDistortionOverlay isActive={isRecallActive} />
      {isHeartbeating && (<div className="fixed inset-0 z-[58] pointer-events-none animate-enhanced-pulse" aria-hidden="true" />)}

      <AppSidebar />

      <div className="flex-1 flex flex-col min-w-0 relative">
        <AppHeader />
        <ChatArea refs={refs} />
        <AppFooter refs={refs} />
      </div>

      <SystemStatusOverlay />
      <AppModals ioActions={ioActions} />
    </div>
  );
};

const SystemStatusOverlay: React.FC = () => {
    const systemStatus = useAppStore(selectors.selectSystemStatus);
    if (!systemStatus) return null;

    return (
        <div className="fixed top-8 left-1/2 -translate-x-1/2 z-[100] animate-in fade-in slide-in-from-top-4 duration-300 pointer-events-none w-full flex justify-center px-4" role="alert">
          <div className={`flex items-center gap-4 px-6 md:px-12 py-5 bg-white/95 dark:bg-gray-800/95 backdrop-blur-xl border border-blue-200 dark:border-blue-900/50 rounded-full shadow-[0_20px_50px_rgba(0,0,0,0.25)] min-w-[300px] md:min-w-[500px] max-w-full justify-center transition-all ${systemStatus.includes("박동") ? 'animate-pulse-blue border-blue-400' : ''}`}>
            <div className="relative flex h-3 w-3 shrink-0"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span><span className="relative inline-flex rounded-full h-3 w-3 bg-blue-500"></span></div>
            <span className="text-xs md:text-sm font-bold text-gray-800 dark:text-gray-100 tracking-tight text-center whitespace-pre-wrap break-keep">{systemStatus}</span>
          </div>
        </div>
    );
};

export default App;
