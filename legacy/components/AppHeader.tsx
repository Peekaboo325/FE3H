
import React from 'react';
import { IconButton } from './ui/IconButton';
import { useAppStore } from '../store/useAppStore';
import * as selectors from '../store/selectors';

export const AppHeader: React.FC = () => {
    const isDarkMode = useAppStore(selectors.selectIsDarkMode);
    const isChronicleMode = useAppStore(selectors.selectIsChronicleMode);
    const toggleDarkMode = useAppStore(state => state.toggleDarkMode);
    const setSidebarOpen = useAppStore(state => state.setSidebarOpen);
    const handleCancelChronicle = useAppStore(state => state.handleCancelChronicle);

    return (
        <header className="h-14 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between px-4 bg-white dark:bg-gray-900 shrink-0 z-20">
            <IconButton onClick={() => { setSidebarOpen(true); if (isChronicleMode) handleCancelChronicle(); }} title="메뉴 열기">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" /></svg>
            </IconButton>
            <IconButton onClick={toggleDarkMode} title={isDarkMode ? "라이트 모드로 전환" : "다크 모드로 전환"}>
                {isDarkMode ? (
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386-1.591 1.591M21 12h-2.25m-.386 6.364-1.591-1.591M12 18.75V21m-4.773-4.227-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0Z" /></svg>
                ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M21.752 15.002A9.72 9.72 0 0 1 18 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 0 0 3 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 0 0 9.002-5.998Z" /></svg>
                )}
            </IconButton>
        </header>
    );
};
