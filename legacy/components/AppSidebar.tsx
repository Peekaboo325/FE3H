
import React from 'react';
import { IconButton } from './ui/IconButton';
import { useAppStore } from '../store/useAppStore';
import * as selectors from '../store/selectors';

export const AppSidebar: React.FC = () => {
  const isOpen = useAppStore(selectors.selectIsSidebarOpen);
  const setSidebarOpen = useAppStore(state => state.setSidebarOpen);
  
  const setCharacterModalOpen = useAppStore(state => state.setCharacterModalOpen);
  const setAdvisorModalOpen = useAppStore(state => state.setAdvisorModalOpen);
  const setIsChronicleMode = useAppStore(state => state.setIsChronicleMode);
  const setIsCompendiumModalOpen = useAppStore(state => state.setIsCompendiumModalOpen);
  const setGalleryModalOpen = useAppStore(state => state.setGalleryModalOpen);
  const setSettingsModalOpen = useAppStore(state => state.setSettingsModalOpen);
  const setSystemModalOpen = useAppStore(state => state.setSystemModalOpen);

  const isChronicleMode = useAppStore(selectors.selectIsChronicleMode);
  const handleCancelChronicle = useAppStore(state => state.handleCancelChronicle);
  
  const handleNavigation = (action: () => void) => {
    setSidebarOpen(false);
    action();
  };

  return (
    <>
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 animate-in fade-in duration-300" 
          onClick={() => setSidebarOpen(false)} 
        />
      )}
      
      <aside 
        className={`fixed inset-y-0 left-0 z-50 w-72 bg-white dark:bg-gray-900 border-r border-gray-100 dark:border-gray-800 transform transition-transform duration-300 ease-in-out ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}
        aria-hidden={!isOpen}
      >
        <div className="flex flex-col h-full">
          <div className="h-14 flex items-center justify-between px-6 border-b border-gray-100 dark:border-gray-800">
            <h2 className="text-[10px] font-bold tracking-[0.2em] uppercase text-gray-500">SYSTEM MENU</h2>
            <IconButton onClick={() => setSidebarOpen(false)} title="메뉴 닫기" className="-mr-1.5 md:-mr-2">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                </svg>
            </IconButton>
          </div>
          <nav className="flex-1 py-6 px-4 space-y-1 overflow-y-auto custom-scrollbar" aria-label="메인 사이드바 메뉴">
            <button 
              onClick={() => handleNavigation(() => setCharacterModalOpen(true))} 
              className="w-full text-left px-4 py-3 rounded hover:bg-gray-50 dark:hover:bg-gray-800 text-sm font-bold uppercase tracking-widest transition-colors flex items-center space-x-3 group"
            >
              <span className="grayscale group-hover:grayscale-0 transition-all">♟️</span><span>유닛 목록</span>
            </button>
            <button 
              onClick={() => handleNavigation(() => setAdvisorModalOpen(true))} 
              className="w-full text-left px-4 py-3 rounded hover:bg-gray-50 dark:hover:bg-gray-800 text-sm font-bold uppercase tracking-widest transition-colors flex items-center space-x-3 group"
            >
              <span className="grayscale group-hover:grayscale-0 transition-all">💬</span><span>전술 고문</span>
            </button>
            
            <button 
                onClick={() => handleNavigation(() => setIsChronicleMode(true))} 
                className="w-full text-left px-4 py-3 rounded hover:bg-gray-50 dark:hover:bg-gray-800 text-sm font-bold uppercase tracking-widest transition-colors flex items-center space-x-3 group"
            >
                <span className="grayscale group-hover:grayscale-0 transition-all">📜</span><span>연대기</span>
            </button>

            <button 
                onClick={() => handleNavigation(() => setIsCompendiumModalOpen(true))} 
                className="w-full text-left px-4 py-3 rounded hover:bg-gray-50 dark:hover:bg-gray-800 text-sm font-bold uppercase tracking-widest transition-colors flex items-center space-x-3 group"
            >
                <span className="grayscale group-hover:grayscale-0 transition-all">📚</span><span>견문록</span>
            </button>

            <button 
              onClick={() => handleNavigation(() => setGalleryModalOpen(true))} 
              className="w-full text-left px-4 py-3 rounded hover:bg-gray-50 dark:hover:bg-gray-800 text-sm font-bold uppercase tracking-widest transition-colors flex items-center space-x-3 group"
            >
              <span className="grayscale group-hover:grayscale-0 transition-all">🖼️</span><span>기억의 조각</span>
            </button>
            
            <button 
              onClick={() => handleNavigation(() => setSettingsModalOpen(true))} 
              className="w-full text-left px-4 py-3 rounded hover:bg-gray-50 dark:hover:bg-gray-800 text-sm font-bold uppercase tracking-widest transition-colors flex items-center space-x-3 group"
            >
              <span className="grayscale group-hover:grayscale-0 transition-all">🔧</span><span>지도 방침</span>
            </button>
            <button 
              onClick={() => handleNavigation(() => setSystemModalOpen(true))} 
              className="w-full text-left px-4 py-3 rounded hover:bg-gray-50 dark:hover:bg-gray-800 text-sm font-bold uppercase tracking-widest transition-colors flex items-center space-x-3 group"
            >
              <span className="grayscale group-hover:grayscale-0 transition-all">⏳</span><span>천각의 박동</span>
            </button>
          </nav>
        </div>
      </aside>
    </>
  );
};
