
import React from 'react';
import { StateCreator } from 'zustand';
import { CharacterProfile } from '../../types/index';
import { db } from '../../utils/db';
import { generateId, extractFirstName } from '../../utils/textUtils';
import { analyzeCharacter } from '../../services/geminiService';
import { processAnalysisResult } from '../../services/characterLogic';
import { AppState, CharacterSlice } from '../types';

export const createCharacterSlice: StateCreator<AppState, [], [], CharacterSlice> = (set, get) => ({
    characters: [],
    analyzingCharId: null,
    processingAnalysisIds: new Set(),
    processingActions: {},
    editingChar: null,
    isEditMode: false,
    aliasesInput: "",

    setCharacters: (chars) => set((state) => ({ characters: typeof chars === 'function' ? chars(state.characters) : chars })),
    setAnalyzingCharId: (id) => set({ analyzingCharId: id }),
    setEditingChar: (char) => set({ editingChar: char }),
    setIsEditMode: (val) => set({ isEditMode: val }),
    setAliasesInput: (val) => set({ aliasesInput: val }),

    handleSaveCharacter: async () => {
        const { editingChar, characters, showStatus, aliasesInput } = get();
        if (!editingChar) return;
        const cleanAliases = aliasesInput ? aliasesInput.split(',').map(s => s.trim()).filter(Boolean) : [];
        
        const isUpdate = !!editingChar.id;
        
        // [PO's SPEC] 캐릭터 명칭 제한 완화 (주요 인물 풀네임 보존을 위해 20자로 확장)
        // 단, AI 지침(core.constants.ts)을 통해 모브 NPC는 여전히 8자 이내 생성을 유도합니다.
        let finalName = editingChar.name.trim();
        if (finalName.length > 20) {
            finalName = finalName.substring(0, 20);
        }

        const charToSave = { 
            ...editingChar, 
            name: finalName,
            aliases: cleanAliases,
            // [PR #Order-Fix] 신규 유닛은 목록의 가장 끝 순서 부여
            order: isUpdate ? editingChar.order : characters.length 
        };
        
        let newChars = [...characters];
        const firstName = extractFirstName(charToSave.name);
        
        if (isUpdate) {
            newChars = newChars.map((c: CharacterProfile) => c.id === charToSave.id ? charToSave : c);
        } else {
            charToSave.id = generateId();
            newChars.push(charToSave as CharacterProfile);
        }
        
        set({ characters: newChars, editingChar: charToSave as CharacterProfile, isEditMode: false });
        await db.saveCharacters(newChars);
        showStatus(isUpdate ? `${firstName}의 기록이 갱신되었습니다.` : `${firstName}의 기록이 작성되었습니다.`);
    },

    handleDeleteCharacter: async (id) => {
        const { characters, showStatus } = get();
        const target = characters.find((c: CharacterProfile) => c.id === id);
        // [PR #Order-Fix] 삭제 후 나머지 유닛들의 order 필드를 재조정하여 저장
        const newChars = characters
            .filter((c: CharacterProfile) => c.id !== id)
            .map((c, idx) => ({ ...c, order: idx }));
            
        set({ characters: newChars, editingChar: null, isEditMode: false });
        await db.saveCharacters(newChars);
        if (target) showStatus(`${extractFirstName(target.name)}의 기록이 소각되었습니다.`);
    },

    handleToggleCharacterActive: async (e, id) => {
        e.stopPropagation();
        const { characters } = get();
        const newChars = characters.map((c: CharacterProfile) => c.id === id ? { ...c, isActive: !c.isActive } : c);
        set({ characters: newChars });
        if (get().editingChar?.id === id) set({ editingChar: newChars.find((c: CharacterProfile) => c.id === id) || null });
        await db.saveCharacters(newChars);
    },

    handleMoveCharacter: async (index, direction) => {
        const { characters } = get();
        let newChars = [...characters];
        if (direction === 'up' && index > 0) {
            [newChars[index - 1], newChars[index]] = [newChars[index], newChars[index - 1]];
        } else if (direction === 'down' && index < characters.length - 1) {
            [newChars[index], newChars[index + 1]] = [newChars[index + 1], newChars[index]];
        } else {
            return;
        }
        
        // [PR #Order-Fix] 바뀐 인덱스에 맞춰 order 재부여
        newChars = newChars.map((c, idx) => ({ ...c, order: idx }));
        set({ characters: newChars });
        await db.saveCharacters(newChars);
    },

    handleReorderCharacters: async (newChars) => {
        // [PR #Order-Fix] 드래그 앤 드롭 결과물에 맞춰 order 필드 영구 보존
        const reordered = newChars.map((c, idx) => ({ ...c, order: idx }));
        set({ characters: reordered });
        await db.saveCharacters(reordered);
    },

    handleUpdateCharacter: async (char) => {
        const { characters, editingChar } = get();
        const newChars = characters.map((c: CharacterProfile) => c.id === char.id ? char : c);
        if (editingChar && editingChar.id === char.id) set({ editingChar: char });
        set({ characters: newChars });
        await db.saveCharacters(newChars);
    },

    handleAnalyzeCharacter: async (char, force, section: 'items' | 'standard' = 'standard') => {
        const { processingAnalysisIds, messages, showStatus, customPrompt, compendium, characters } = get();
        if (processingAnalysisIds.has(char.id)) return;
        set((state) => ({ 
            processingAnalysisIds: new Set(state.processingAnalysisIds).add(char.id),
            processingActions: { ...state.processingActions, [char.id]: section } 
        }));
        const firstName = extractFirstName(char.name);
        try {
            const isUpdate = !!char.analysis;
            const partialAnalysis = await analyzeCharacter(char, messages, section, customPrompt, compendium, characters);
            const mergedAnalysis = processAnalysisResult(char, partialAnalysis, section);
            let updatedChar = { ...char, analysis: mergedAnalysis };
            if (mergedAnalysis.bond_themes && updatedChar.bonds) {
                updatedChar.bonds = updatedChar.bonds.map(bond => ({
                    ...bond,
                    theme: mergedAnalysis.bond_themes?.[bond.id] || bond.theme
                }));
            }
            await get().handleUpdateCharacter(updatedChar);
            if (section !== 'items') { 
                const isViewing = get().analyzingCharId === char.id;
                if (isUpdate || !isViewing) showStatus(isUpdate ? `${firstName}의 분석 보고서를 갱신하였습니다.` : `${firstName}의 분석 보고서가 발급되었습니다.`);
            }
        } catch (e: any) {
            console.error("Analysis failed", e);
            set({ analyzingCharId: null });
            showStatus(`${firstName}의 분석 보고서 발급이 중단되었습니다.`);
        } finally {
            set((state) => {
                const nextIds = new Set(state.processingAnalysisIds);
                nextIds.delete(char.id);
                const nextActions = { ...state.processingActions };
                delete nextActions[char.id];
                return { processingAnalysisIds: nextIds, processingActions: nextActions };
            });
        }
    },
});
