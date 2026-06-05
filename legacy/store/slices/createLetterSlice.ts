
import { StateCreator } from 'zustand';
import { Letter } from '../../types/index';
import { letterStore } from '../../services/db/letterStore';
import { letterService } from '../../services/chat/letterService';
import { extractFirstName } from '../../utils/textUtils';
import { AppState, LetterSlice } from '../types';

export const createLetterSlice: StateCreator<AppState, [], [], LetterSlice> = (set, get) => ({
  letters: [],
  setLetters: (letters) => set({ letters }),
  
  addLetter: async (letter) => {
    const newLetters = [...get().letters, letter];
    set({ letters: newLetters });
    await letterStore.saveLetters([letter]);
  },

  updateLetter: async (letter) => {
    const newLetters = get().letters.map(l => l.id === letter.id ? letter : l);
    set({ letters: newLetters });
    await letterStore.saveLetters([letter]);
  },

  deleteLetter: async (id) => {
    const newLetters = get().letters.filter(l => l.id !== id);
    set({ letters: newLetters });
    await letterStore.deleteLetter(id);
  },

  markLetterAsRead: async (id) => {
    const newLetters = get().letters.map(l => 
      l.id === id ? { ...l, isSealed: false } : l
    );
    set({ letters: newLetters });
    await letterStore.markAsRead(id);
  },

  loadLetters: async () => {
    const letters = await letterStore.getAllLetters();
    set({ letters });
  },

  handleRefreshLetters: async (charId: string) => {
    const state = get() as any;
    const { characters, messages, showStatus, processingAnalysisIds } = state;
    
    if (processingAnalysisIds.has(charId)) return;
    
    (set as any)((s: any) => ({
        processingAnalysisIds: new Set(s.processingAnalysisIds).add(charId),
        processingActions: { ...s.processingActions, [charId]: 'letters' }
    }));

    const majorUnits = characters.filter((c: any) => c.isActive);
    const char = characters.find((c: any) => c.id === charId);
    const firstName = char ? extractFirstName(char.name) : '';

    try {
      // [Consolidated] 원문 및 답장 통합 동기화 (15초 쿨다운 적용됨)
      const newLetters = await letterService.syncLetters(characters, messages, undefined, charId);
      
      // 다시 로드
      const letters = await letterStore.getAllLetters();
      set({ letters });
      
      if (char) {
        if (newLetters.length > 0) {
          showStatus(`${firstName}에게 새로운 서신이 도착했습니다.`);
        } else {
          // 쿨다운이나 후보 없음 등으로 생성이 안 된 경우
          showStatus(`${firstName}의 서신함을 확인했습니다.`);
        }
      }
    } catch (error) {
      console.error("Letter refresh failed", error);
      showStatus("서신함 갱신 중 오류가 발생했습니다.");
    } finally {
      (set as any)((s: any) => {
        const nextIds = new Set(s.processingAnalysisIds);
        nextIds.delete(charId);
        const nextActions = { ...s.processingActions };
        delete nextActions[charId];
        return { processingAnalysisIds: nextIds, processingActions: nextActions };
      });
    }
  }
});
