
import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useAppStore } from '../store/useAppStore';
import { useShallow } from 'zustand/react/shallow';
import { CharacterProfile, BelongingItem } from '../types/index';
import { generateId } from '../utils/textUtils';

export const useAnalysisModal = () => {
    const analyzingCharId = useAppStore(state => state.analyzingCharId);
    const characters = useAppStore(state => state.characters);
    const messages = useAppStore(state => state.messages);
    const customPrompt = useAppStore(state => state.customPrompt);
    const storyParams = useAppStore(state => state.storyParams);
    const compendium = useAppStore(state => state.compendium);
    
    const { 
        processingAnalysisIds, processingActions, setAnalyzingCharId, 
        handleAnalyzeCharacter, handleUpdateCharacter, handleRefreshLetters,
        markLetterAsRead, updateLetter, deleteLetter, letters
    } = useAppStore(useShallow(state => ({
        processingAnalysisIds: state.processingAnalysisIds,
        processingActions: state.processingActions,
        setAnalyzingCharId: state.setAnalyzingCharId,
        handleAnalyzeCharacter: state.handleAnalyzeCharacter,
        handleUpdateCharacter: state.handleUpdateCharacter,
        handleRefreshLetters: state.handleRefreshLetters,
        markLetterAsRead: state.markLetterAsRead,
        updateLetter: state.updateLetter,
        deleteLetter: state.deleteLetter,
        letters: state.letters
    })));

    const character = useMemo(() => characters.find(c => c.id === analyzingCharId), [characters, analyzingCharId]);
    const isGlobalLoading = useMemo(() => analyzingCharId ? processingAnalysisIds.has(analyzingCharId) : false, [analyzingCharId, processingAnalysisIds]);
    const currentAction = useMemo(() => analyzingCharId ? processingActions[analyzingCharId] : undefined, [analyzingCharId, processingActions]);

    const [activeTab, setActiveTab] = useState<'ability' | 'core' | 'quests' | 'items' | 'letters'>(
        window.innerWidth < 768 ? 'ability' : 'core'
    );
    const [isManageMode, setIsManageMode] = useState(false);
    const [selectedItemIds, setSelectedItemIds] = useState<Set<string>>(new Set());

    const autoAnalysisAttemptedRef = useRef<Record<string, number>>({});

    useEffect(() => {
        if (character?.analysis?.belongings) {
            const hasLegacyItems = character.analysis.belongings.some(item => !item.stableId);
            if (hasLegacyItems) {
                const updatedBelongings = character.analysis.belongings.map(item => ({
                    ...item,
                    stableId: item.stableId || generateId()
                }));
                handleUpdateCharacter({ ...character, analysis: { ...character.analysis, belongings: updatedBelongings } });
            }
        }
    }, [character?.id]);

    useEffect(() => { 
        setIsManageMode(false); setSelectedItemIds(new Set());
        if (analyzingCharId) setActiveTab(window.innerWidth < 768 ? 'ability' : 'core');
    }, [analyzingCharId]); 

    useEffect(() => {
        const handleResize = () => { if (window.innerWidth >= 768 && activeTab === 'ability') setActiveTab('core'); };
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, [activeTab]);

    useEffect(() => {
        if (!character || isGlobalLoading || !analyzingCharId) return;
        const isCorrupted = !character.analysis || !character.analysis.stats || Object.values(character.analysis.stats).every(v => v === 0) || !character.analysis.quests || character.analysis.quests.length === 0;
        if (isCorrupted) {
            const attempts = autoAnalysisAttemptedRef.current[analyzingCharId] || 0;
            if (attempts < 1) {
                autoAnalysisAttemptedRef.current[analyzingCharId] = attempts + 1;
                handleAnalyzeCharacter(character, true, 'standard');
            }
        }
    }, [character?.id, isGlobalLoading, handleAnalyzeCharacter, analyzingCharId]);

    const handleToggleItemSelection = useCallback((id: string) => {
        setSelectedItemIds(prev => { 
            const next = new Set(prev); 
            if (next.has(id)) next.delete(id); else next.add(id); 
            return next; 
        });
    }, []);

    const handleBulkDeleteItems = useCallback(() => {
        if (!character || !character.analysis?.belongings || selectedItemIds.size === 0) return;
        const newBelongings = character.analysis.belongings.filter(item => !selectedItemIds.has(item.stableId));
        handleUpdateCharacter({ ...character, analysis: { ...character.analysis, belongings: newBelongings } });
        setSelectedItemIds(new Set());
        setIsManageMode(false); 
    }, [character, selectedItemIds, handleUpdateCharacter]);

    const handleItemClick = useCallback((id: string) => {
        if (!character || !character.analysis?.belongings) return;
        const index = character.analysis.belongings.findIndex(item => item.stableId === id);
        if (index === -1) return;
        const targetItem = character.analysis.belongings[index];
        if (targetItem.isNew) {
            const newBelongings = [...character.analysis.belongings];
            newBelongings[index] = { ...targetItem, isNew: false };
            handleUpdateCharacter({ ...character, analysis: { ...character.analysis, belongings: newBelongings } });
        }
    }, [character, handleUpdateCharacter]);

    const isAnalyzingStandard = isGlobalLoading && currentAction === 'standard';
    const isExploringItems = isGlobalLoading && currentAction === 'items';
    const isRefreshingLetters = isGlobalLoading && currentAction === 'letters';

    return { 
        character, isGlobalLoading, isAnalyzingStandard, isExploringItems, isRefreshingLetters,
        activeTab, setActiveTab, isManageMode, setIsManageMode, selectedItemIds, 
        setAnalyzingCharId, handleAnalyzeCharacter, handleToggleItemSelection, 
        handleBulkDeleteItems, handleItemClick, handleUpdateCharacter,
        handleRefreshLetters,
        markLetterAsRead, updateLetter, deleteLetter, letters, characters
    };
};
