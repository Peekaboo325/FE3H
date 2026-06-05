
import { useCallback, useEffect } from 'react';
import { db } from '../utils/db';
import { useAppStore } from '../store/useAppStore';
import { Period, StoryParams } from '../types/index';
import { assetManager } from '../services/system/assetManager';

export const useAppInitializer = () => {
    const { 
        isInitialized,
        setInitialized, setPeriod, setStoryParams, setCustomPrompt, setIsDarkMode,
        setUseAtmosphereInfiltration, setUseSituationalAwareness, setUseSerendipity,
        setMessages, setCharacters, setChronicles, setCompendium, setLetters,
        messages, characters, chronicles, compendium, letters, period, storyParams, customPrompt, isDarkMode,
        useAtmosphereInfiltration, useSituationalAwareness, useSerendipity
    } = useAppStore();

    const initialize = useCallback(async () => {
        try {
            await db.initDB();
            const [
                storedMsgs, storedChars, storedChronicles, storedCompendium, storedLetters,
                storedPeriod, storedParams, storedCustomPrompt, storedIsDarkMode,
                storedAtmosphere, storedAwareness, storedSerendipity
            ] = await Promise.all([
                db.getMessages(),
                db.getCharacters(),
                db.getChronicles(),
                db.getCompendiumEntries(),
                db.getAllLetters(),
                db.getSetting<Period>('period'),
                db.getSetting<StoryParams>('storyParams'),
                db.getSetting<string>('customPrompt'),
                db.getSetting<boolean>('isDarkMode'),
                db.getSetting<boolean>('useAtmosphereInfiltration'),
                db.getSetting<boolean>('useSituationalAwareness'),
                db.getSetting<boolean>('useSerendipity')
            ]);
            
            setMessages(storedMsgs || []);
            setCharacters(storedChars || []);
            setChronicles(storedChronicles || []);
            setCompendium(storedCompendium || []);
            setLetters(storedLetters || []);
            
            if (storedPeriod) setPeriod(storedPeriod);
            if (storedParams) setStoryParams(storedParams);
            if (storedCustomPrompt) setCustomPrompt(storedCustomPrompt);
            if (storedIsDarkMode !== null) setIsDarkMode(storedIsDarkMode);
            
            if (storedAtmosphere !== null) setUseAtmosphereInfiltration(storedAtmosphere);
            if (storedAwareness !== null) setUseSituationalAwareness(storedAwareness);
            if (storedSerendipity !== null) setUseSerendipity(storedSerendipity);

            setInitialized(true);
        } catch (error) {
            console.error("[INITIALIZER] Failure:", error);
        }
    }, [setPeriod, setStoryParams, setCustomPrompt, setIsDarkMode, setInitialized, setMessages, setCharacters, setChronicles, setCompendium, setLetters, setUseAtmosphereInfiltration, setUseSituationalAwareness, setUseSerendipity]);

    useEffect(() => {
        // [Hotfix] Always force re-initialization on mount to refresh session-specific Blob URLs
        setInitialized(false);
        initialize();
    }, []); // Run once on mount

    // [PR #Order-Fix] 슬라이스 내 개별 액션 함수에서 명시적으로 저장하므로 중복 저장은 불필요하며, 
    // 정렬 순서 보존을 위해 제거합니다.
    useEffect(() => { if (isInitialized) db.saveMessages(messages); }, [messages, isInitialized]);
    
    useEffect(() => { 
        if (isInitialized) {
            compendium.forEach(entry => db.saveCompendiumEntry(entry));
        } 
    }, [compendium, isInitialized]);

    useEffect(() => { if (isInitialized) db.saveSetting('period', period); }, [period, isInitialized]);
    useEffect(() => { if (isInitialized) db.saveSetting('storyParams', storyParams); }, [storyParams, isInitialized]);
    useEffect(() => { if (isInitialized) db.saveSetting('customPrompt', customPrompt); }, [customPrompt, isInitialized]);
    useEffect(() => { if (isInitialized) db.saveSetting('isDarkMode', isDarkMode); }, [isDarkMode, isInitialized]);
    
    useEffect(() => { if (isInitialized) db.saveSetting('useAtmosphereInfiltration', useAtmosphereInfiltration); }, [useAtmosphereInfiltration, isInitialized]);
    useEffect(() => { if (isInitialized) db.saveSetting('useSituationalAwareness', useSituationalAwareness); }, [useSituationalAwareness, isInitialized]);
    useEffect(() => { if (isInitialized) db.saveSetting('useSerendipity', useSerendipity); }, [useSerendipity, isInitialized]);

    useEffect(() => {
        if (isDarkMode) document.documentElement.classList.add('dark');
        else document.documentElement.classList.remove('dark');
    }, [isDarkMode]);

    return { isInitialized };
};
