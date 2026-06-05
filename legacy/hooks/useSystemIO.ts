
import React, { useCallback } from 'react';
import { useAppStore } from '../store/useAppStore';
import { db } from '../utils/db';
import { serializeAppData, deserializeAppData, formatNarrativeToText } from '../services/system/ioService';

/**
 * [Phase 2-H] System IO Hook: Handles browser-level file interactions
 */
export const useSystemIO = () => {
    const { 
        messages, characters, chronicles, compendium, letters, period, storyParams, customPrompt, isDarkMode,
        setMessages, setCharacters, setChronicles, setCompendium, setLetters, setPeriod, setStoryParams, setCustomPrompt, setIsDarkMode,
        showStatus, setIsSessionReset 
    } = useAppStore();

    const handleExport = useCallback(async (callback?: () => void) => {
        try {
            const data = await serializeAppData(messages, characters, chronicles, compendium, letters, period, storyParams, customPrompt, isDarkMode);
            const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `fodlan_backup_${new Date().toISOString().slice(0,10)}.json`;
            a.click();
            url && URL.revokeObjectURL(url);
            showStatus("모든 기록이 봉인되어 보존됩니다.");
            callback?.();
        } catch (e) {
            console.error(e);
            showStatus("기록 보존에 실패했습니다.");
        }
    }, [messages, characters, chronicles, compendium, period, storyParams, customPrompt, isDarkMode, showStatus]);

    const handleExportText = useCallback((callback?: () => void) => {
        const finalOutput = formatNarrativeToText(messages);
        if (!finalOutput) {
            showStatus("출력할 기록이 없습니다.");
            return;
        }
        const blob = new Blob([finalOutput], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `fodlan_narrative_${new Date().toISOString().slice(0,10)}.txt`;
        a.click();
        url && URL.revokeObjectURL(url);
        showStatus("클린 텍스트 기록 사본이 출력되었습니다.");
        callback?.();
    }, [messages, showStatus]);

    const handleImport = useCallback((e: React.ChangeEvent<HTMLInputElement>, callback?: () => void) => {
        const file = e.target.files?.[0];
        if (!file) return;
        
        const reader = new FileReader();
        reader.onload = async (event) => {
            try {
                const rawJson = JSON.parse(event.target?.result as string);
                
                // [Portrait Preservation] 서사 데이터만 있는 백업 로드 시 기존 유닛의 초상화가 유실되는 것을 방지
                const existingThumbnails = new Map(characters.map(c => [c.name, c.thumbnail]));
                
                // Cleanup existing URLs (Messages are always replaced)
                messages.forEach(m => { if(m.image?.startsWith('blob:')) URL.revokeObjectURL(m.image); });
                
                const json = await deserializeAppData(rawJson);
                
                // [Sync Fix] Update state AND IndexedDB to prevent data loss on refresh
                if (json.messages) {
                    setMessages(json.messages);
                    await db.clearStore(db.STORE_MESSAGES);
                    await db.saveMessages(json.messages);
                }
                if (json.characters) {
                    const mergedCharacters = json.characters.map((c: any) => {
                        // 가져온 데이터에 썸네일이 없고 기존에 있다면 보존
                        if (!c.thumbnail && existingThumbnails.has(c.name)) {
                            return { ...c, thumbnail: existingThumbnails.get(c.name) };
                        }
                        // 썸네일이 교체되는 경우에만 기존 blob 해제
                        const oldThumb = existingThumbnails.get(c.name);
                        if (oldThumb && oldThumb.startsWith('blob:') && oldThumb !== c.thumbnail) {
                            URL.revokeObjectURL(oldThumb);
                        }
                        return c;
                    });

                    // 목록에서 사라진 유닛의 blob 해제
                    const newNames = new Set(json.characters.map((c: any) => c.name));
                    characters.forEach(c => {
                        if (!newNames.has(c.name) && c.thumbnail?.startsWith('blob:')) {
                            URL.revokeObjectURL(c.thumbnail);
                        }
                    });

                    setCharacters(mergedCharacters);
                    await db.clearStore(db.STORE_CHARACTERS);
                    await db.saveCharacters(mergedCharacters);
                }
                
                // [Session Hard Reset] 기록 복원 시 기존 기억 소각 및 AI 세션 초기화 신호 활성화
                await db.clearStore(db.STORE_MEMORIES);
                setIsSessionReset(true);

                if (json.chronicles) {
                    setChronicles(json.chronicles);
                    await db.clearStore(db.STORE_CHRONICLES);
                    await db.saveChronicles(json.chronicles);
                }
                if (json.compendium) {
                    setCompendium(json.compendium);
                    await db.clearStore(db.STORE_COMPENDIUM);
                    await db.saveCompendiumEntries(json.compendium);
                }
                if (json.letters) {
                    setLetters(json.letters);
                    await db.clearStore(db.STORE_LETTERS);
                    await db.saveLetters(json.letters);
                }
                if (json.period) {
                    setPeriod(json.period);
                    await db.saveSetting('period', json.period);
                }
                if (json.storyParams) {
                    setStoryParams(json.storyParams);
                    await db.saveSetting('storyParams', json.storyParams);
                }
                if (json.customPrompt) {
                    setCustomPrompt(json.customPrompt);
                    await db.saveSetting('customPrompt', json.customPrompt);
                }
                if (typeof json.isDarkMode === 'boolean') {
                    setIsDarkMode(json.isDarkMode);
                    await db.saveSetting('isDarkMode', json.isDarkMode);
                }
                
                showStatus("보존된 기록이 복원되었습니다.");
                callback?.();
            } catch (err) {
                console.error(err);
                alert("올바르지 않은 백업 파일입니다.");
            } finally {
                // [iOS Fix] Reset input value to allow re-selection of the same file
                if (e.target) e.target.value = '';
            }
        };
        reader.readAsText(file);
    }, [setPeriod, setStoryParams, setCustomPrompt, setIsDarkMode, setMessages, setCharacters, setChronicles, setCompendium, showStatus, messages, characters]);

    const handleReset = useCallback(async (options: { resetStory: boolean; resetCharacters: boolean; resetCompendium: boolean; resetSettings: boolean; resetLetters?: boolean }, callback?: () => void) => {
        try {
            if (options.resetStory) {
                messages.forEach(m => { if(m.image?.startsWith('blob:')) URL.revokeObjectURL(m.image); });
                await db.clearStore(db.STORE_MESSAGES);
                await db.clearStore(db.STORE_CHRONICLES); 
                await db.clearStore(db.STORE_MEMORIES); // [CRITICAL] 보이지 않는 기억 DB 소각 추가
                await db.stripCharacterAnalysis();
                setMessages([]);
                setChronicles([]);
                setIsSessionReset(true); // [Session Hard Reset]
                
                // [Sovereign Causality] 서사 초기화 시 유닛의 참여도/언급 회차 기록도 인과에 맞게 0으로 정화
                const sanitizedChars = characters.map(c => ({ 
                    ...c, 
                    analysis: undefined,
                    diary_entries: undefined, // [Purification] Clear diary entries on reset
                    last_appearance_ep: undefined,
                    last_mention_ep: undefined
                }));
                setCharacters(sanitizedChars);
                await db.saveCharacters(sanitizedChars);
            }
            if (options.resetLetters || options.resetStory) {
                // [Phase 1] Letters are also cleared when story is reset, or explicitly
                await db.clearStore(db.STORE_LETTERS);
                setLetters([]);
            }
            if (options.resetCharacters) {
                characters.forEach(c => { if(c.thumbnail?.startsWith('blob:')) URL.revokeObjectURL(c.thumbnail); });
                await db.clearStore(db.STORE_CHARACTERS);
                setCharacters([]);
            }
            if (options.resetCompendium) {
                await db.clearStore(db.STORE_COMPENDIUM);
                setCompendium([]);
            }
            if (options.resetSettings) {
                await db.deleteSetting('period');
                await db.deleteSetting('storyParams');
                await db.deleteSetting('customPrompt');
                await db.deleteSetting('isDarkMode');
                setPeriod(null);
                setStoryParams({ sensuality: 1, speed: 3 });
                setCustomPrompt("");
                setIsDarkMode(false);
            }
            showStatus("모든 인과가 불꽃 속에서 사라집니다.");
            callback?.();
        } catch (e) {
            console.error("Reset failed", e);
            alert("초기화 중 오류가 발생했습니다.");
        }
    }, [setPeriod, setStoryParams, setCustomPrompt, setIsDarkMode, setMessages, setChronicles, setCompendium, setLetters, setCharacters, showStatus, messages, characters]);

    return { handleExport, handleExportText, handleImport, handleReset };
};
