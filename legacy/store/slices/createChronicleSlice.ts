
import { StateCreator } from 'zustand';
import { ChronicleEntry, Message, DialogueItem } from '../../types/index';
import { db } from '../../utils/db';
import { generateId } from '../../utils/textUtils';
import { generateChronicle } from '../../services/geminiService';
import { formatFodlanDateRange } from '../../utils/dateUtils';
import { parseMeta } from '../../utils/chronicleUtils';
import { ChronicleField } from '../../services/gemini/prompts';
import { AppState, ChronicleSlice } from '../types';

const scrubDialogues = (list: DialogueItem[] | undefined): DialogueItem[] => {
    if (!list) return [];
    return list.filter(d => d.line && d.line.trim().length > 0);
};

const scrubDates = (text: string | undefined): string => {
    if (!text) return "";
    return text
        .replace(/제국력\s*\d+년\s*[가-힣]+\s*의\s*달\s*\d+일[:\s\-]*/g, '')
        .replace(/[가-힣]+\s*의\s*달\s*\d+일[:\s\-]*/g, '')
        .replace(/^.*화\s*:\s*/, '')
        .trim();
};

const extractEpisodeNumbers = (messages: Message[]): number[] => {
    const episodeRegex = /###\s*(\d+)화/g;
    const episodes = new Set<number>();
    messages.forEach(m => {
        if (m.role === 'model') {
            let match;
            while ((match = episodeRegex.exec(m.content)) !== null) episodes.add(parseInt(match[1], 10));
        }
    });
    return Array.from(episodes).sort((a, b) => a - b);
};

const reorderChronicles = (chronicles: ChronicleEntry[], messages: Message[]): ChronicleEntry[] => {
    const withIndex = chronicles.map(c => {
        let index = -1;
        if (c.startMessageId) index = messages.findIndex(m => m.id === c.startMessageId);
        if (index === -1) index = c.timestamp; 
        return { ...c, _sortIndex: index };
    });
    withIndex.sort((a, b) => a._sortIndex - b._sortIndex);
    return withIndex.map((c, idx) => {
        const chapterNum = idx + 1;
        
        // [Strategy: Normalize Range Format]
        // 기존의 복잡한 표기(제XX화 기록 등)를 '제X장' 표준 형식으로 정리합니다.
        const { count } = parseMeta(c.range);
        const logCount = count || "1"; // 로그 건수가 없으면 최소 1건으로 간주
        const newRange = `제${chapterNum}장 (로그 ${logCount}건)`;
        
        const { _sortIndex, ...rest } = c;
        return { ...rest, range: newRange };
    });
};

export const createChronicleSlice: StateCreator<AppState, [], [], ChronicleSlice> = (set, get) => ({
    chronicles: [],
    isChronicleMode: false,
    isChronicleProcessing: false,
    processingField: null,
    selectionStartId: null,
    selectionEndId: null,
    viewingChronicleId: null,
    isChronicleModalOpen: false,

    setChronicles: (chronicles) => set({ chronicles }),
    setIsChronicleMode: (val) => set({ isChronicleMode: val }),
    setSelectionStartId: (id) => set({ selectionStartId: id }),
    setSelectionEndId: (id) => set({ selectionEndId: id }),
    setViewingChronicleId: (id) => set({ viewingChronicleId: id }),
    setIsChronicleModalOpen: (val) => set({ isChronicleModalOpen: val }),

    handleToggleSelection: (id) => {
        const { selectionStartId, selectionEndId, messages } = get();
        const currentIdx = messages.findIndex((m: Message) => m.id === id);
        if (currentIdx === -1) return;

        // [Fix] 유저 메시지는 선택 대상에서 제외
        if (messages[currentIdx].role === 'user') return;

        // Helper: 에피소드 경계 찾기 (Snap to Episode)
        const findEpBoundaries = (idx: number) => {
            let start = -1;
            for (let i = idx; i >= 0; i--) {
                if (messages[i].role === 'model' && /###\s*\d+화/.test(messages[i].content)) {
                    start = i;
                    break;
                }
            }
            const s = start !== -1 ? start : idx;
            
            let next = -1;
            for (let i = s + 1; i < messages.length; i++) {
                if (messages[i].role === 'model' && /###\s*\d+화/.test(messages[i].content)) {
                    next = i;
                    break;
                }
            }
            
            // [Fix] e는 다음 에피소드 직전의 '마지막 모델 메시지'여야 함
            let end = -1;
            const searchLimit = next !== -1 ? next : messages.length;
            for (let i = searchLimit - 1; i >= s; i--) {
                if (messages[i].role === 'model') {
                    end = i;
                    break;
                }
            }
            const e = end !== -1 ? end : s;
            return { s, e };
        };

        // 1. 선택이 없는 경우 -> 단일 에피소드 자동 선택
        if (!selectionStartId || !selectionEndId) {
            const { s, e } = findEpBoundaries(currentIdx);
            set({ selectionStartId: messages[s].id, selectionEndId: messages[e].id });
            return;
        }

        // 2. 선택이 이미 있는 경우
        const startIdx = messages.findIndex(m => m.id === selectionStartId);
        const endIdx = messages.findIndex(m => m.id === selectionEndId);

        // 2-A. 선택 영역 내부 클릭 -> 선택 해제 (Clear)
        if (currentIdx >= startIdx && currentIdx <= endIdx) {
            set({ selectionStartId: null, selectionEndId: null });
            return;
        }

        // 2-B. 선택 영역 외부 클릭 -> 범위 확장 (Smart Extension)
        const { s: newS, e: newE } = findEpBoundaries(currentIdx);
        if (currentIdx < startIdx) {
            // 위쪽으로 확장
            set({ selectionStartId: messages[newS].id });
        } else {
            // 아래쪽으로 확장
            set({ selectionEndId: messages[newE].id });
        }
    },

    getSelectedMessages: () => {
        const { messages, selectionStartId, selectionEndId } = get();
        if (!selectionStartId || !selectionEndId) return [];
        const startIdx = messages.findIndex((m: Message) => m.id === selectionStartId);
        const endIdx = messages.findIndex((m: Message) => m.id === selectionEndId);
        if (startIdx === -1 || endIdx === -1) return [];
        return messages.slice(startIdx, endIdx + 1);
    },

    handleCancelChronicle: () => {
        const { isChronicleProcessing, showStatus, setSystemStatus } = get();
        if (isChronicleProcessing) {
            setSystemStatus(null);
            showStatus("연대기 집필이 중단되었습니다.");
        }
        set({ isChronicleMode: false, isChronicleProcessing: false, processingField: null, selectionStartId: null, selectionEndId: null });
    },

    handleCreateChronicle: async () => {
        const { getSelectedMessages, chronicles, messages, showStatus, setSystemStatus } = get();
        const selected = getSelectedMessages();
        if (selected.length === 0) return;
        const narrativeOnly = selected.filter((m: Message) => m.role === 'model');
        if (narrativeOnly.length === 0) {
            showStatus("기록이 존재하지 않습니다.");
            return;
        }
        set({ isChronicleProcessing: true, processingField: 'full' });
        
        try {
            const tempChapterNum = chronicles.length + 1;
            const rangeTitle = `제${tempChapterNum}장 (로그 ${narrativeOnly.length}건)`;
            const scannedEpisodes = extractEpisodeNumbers(narrativeOnly);
            
            let firstDate: string | null = null, lastDate: string | null = null;
            for (const m of narrativeOnly) {
                const match = m.content.match(/<sub[^>]*>(.*?)<\/sub>/i);
                if (match) { if (!firstDate) firstDate = match[1]; lastDate = match[1]; }
            }
            if (!firstDate) firstDate = "날짜 미상";
            if (!lastDate) lastDate = firstDate;
            const dateRangeStr = formatFodlanDateRange(firstDate, lastDate);

            // [Strategy: Sequential & Hybrid Model]
            // 쿼터 초과 방지를 위해 순차적으로 실행하며, 중요도에 따라 모델을 믹스합니다.
            const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

            setSystemStatus("서사의 제목과 상태 변화를 정의하는 중...");
            const meta = await generateChronicle(narrativeOnly, rangeTitle, 'meta', 'gemini-3.1-pro-preview');
            await delay(1200);

            setSystemStatus("전체 줄거리를 정밀하게 요약하는 중...");
            const summary = await generateChronicle(narrativeOnly, rangeTitle, 'summary', 'gemini-3.1-pro-preview');
            await delay(1200);

            setSystemStatus("주요 사건들을 연대기순으로 정리하는 중...");
            const events = await generateChronicle(narrativeOnly, rangeTitle, 'key_events', 'gemini-3-flash-preview');
            await delay(1000);

            setSystemStatus("인상적인 대사들을 추출하는 중...");
            const dialogues = await generateChronicle(narrativeOnly, rangeTitle, 'major_dialogues', 'gemini-3.1-pro-preview');
            await delay(1200);

            setSystemStatus("핵심 키워드와 인물들을 분류하는 중...");
            const tags = await generateChronicle(narrativeOnly, rangeTitle, 'tags', 'gemini-3-flash-preview');

            if (!get().isChronicleMode) { setSystemStatus(null); return; }

            const finalEpisodes = (meta.contained_episodes && meta.contained_episodes.length > 0) ? meta.contained_episodes : scannedEpisodes;
            const cleanSummary = scrubDates(summary.summary);
            const cleanEvents = (events.key_events || []).map(e => scrubDates(e));
            const cleanDialogues = scrubDialogues(dialogues.major_dialogues);

            const newChronicle: ChronicleEntry = {
                id: generateId(),
                range: rangeTitle,
                title: meta.title || "무제",
                summary: cleanSummary || "요약 실패",
                state_changes: meta.state_changes || [],
                seeds: [],
                key_events: cleanEvents,
                major_dialogues: cleanDialogues,
                tags: tags.tags || { person: [], place: [], topic: [], item: [], sentiment: [] },
                contained_episodes: finalEpisodes,
                date: dateRangeStr,
                timestamp: Date.now(),
                startMessageId: narrativeOnly[0].id,
                endMessageId: narrativeOnly[narrativeOnly.length - 1].id,
                isReferenced: false,
                keywords: [] 
            };

            const updatedList = [...chronicles, newChronicle];
            const reorderedList = reorderChronicles(updatedList, messages);
            const finalNewChronicle = reorderedList.find(c => c.id === newChronicle.id);
            const finalChapterName = finalNewChronicle?.range.split(' ')[0] || `제${tempChapterNum}장`;

            setSystemStatus(null);
            set({ chronicles: reorderedList, selectionStartId: null, selectionEndId: null, isChronicleMode: false, isChronicleModalOpen: true, viewingChronicleId: finalNewChronicle?.id || newChronicle.id });
            for (const c of reorderedList) await db.saveChronicle(c);
            
            showStatus(`${narrativeOnly.length}개의 기록으로 ${finalChapterName}이 완성되었습니다.`);
        } catch (e) {
            console.error(e);
            setSystemStatus(null);
            showStatus("연대기 집필이 중단되었습니다.");
        } finally {
            set({ isChronicleProcessing: false, processingField: null });
        }
    },

    handlePartialRefreshChronicle: async (entry, field) => {
        const { messages, showStatus, handleUpdateChronicle } = get();
        if (get().isChronicleProcessing) return;
        set({ isChronicleProcessing: true, processingField: field });
        
        // v4.6.4: Improved partial refresh status text
        showStatus("해당 기록의 행간을 들여다보는 중...");

        try {
            let subset: Message[] = [];
            if (entry.startMessageId && entry.endMessageId) {
                const startIdx = messages.findIndex((m: Message) => m.id === entry.startMessageId);
                const endIdx = messages.findIndex((m: Message) => m.id === entry.endMessageId);
                if (startIdx !== -1 && endIdx !== -1) subset = messages.slice(startIdx, endIdx + 1);
            }
            if (subset.length === 0) { showStatus("원본 기록이 소각된 상태입니다."); return; }
            const narrativeOnly = subset.filter((m: Message) => m.role === 'model');
            
            const result = await generateChronicle(narrativeOnly, entry.range, field);
            if (result) {
                const updated: ChronicleEntry = { ...entry };
                const fieldLabels: Record<ChronicleField, string> = {
                    summary: "줄거리", key_events: "주요 사건", major_dialogues: "주요 대사", tags: "키워드", meta: "제목 및 상태", state_changes: "상태 변화", seeds: "미스터리"
                };

                if (field === 'meta') {
                    updated.title = result.title || entry.title;
                    updated.state_changes = result.state_changes || entry.state_changes;
                    if (result.contained_episodes && result.contained_episodes.length > 0) updated.contained_episodes = result.contained_episodes;
                } else if (field === 'summary') updated.summary = scrubDates(result.summary) || entry.summary;
                else if (field === 'key_events') updated.key_events = (result.key_events || []).map(e => scrubDates(e));
                else if (field === 'seeds') updated.seeds = result.seeds || [];
                else if (field === 'major_dialogues') updated.major_dialogues = scrubDialogues(result.major_dialogues);
                else (updated as any)[field] = result[field];
                handleUpdateChronicle(updated);
                showStatus(`[${fieldLabels[field]}] 항목이 갱신되었습니다.`);
            }
        } catch (e) {
            console.error(e);
            showStatus("항목 갱신이 중단되었습니다.");
        } finally {
            set({ isChronicleProcessing: false, processingField: null });
        }
    },

    handleDeleteChronicle: async (id) => {
        const { chronicles, messages } = get();
        const filteredList = chronicles.filter((c: ChronicleEntry) => c.id !== id);
        const reorderedList = reorderChronicles(filteredList, messages);
        set({ chronicles: reorderedList, viewingChronicleId: null });
        await db.deleteChronicle(id);
        for (const c of reorderedList) await db.saveChronicle(c);
    },

    handleUpdateChronicle: async (entry) => {
        const { chronicles } = get();
        const scrubbedEntry = { ...entry, major_dialogues: scrubDialogues(entry.major_dialogues) };
        const updated = chronicles.map((c: ChronicleEntry) => c.id === entry.id ? scrubbedEntry : c);
        set({ chronicles: updated });
        await db.saveChronicle(scrubbedEntry);
    },

    handleToggleReference: async (id) => {
        const { chronicles } = get();
        const updated = chronicles.map((c: ChronicleEntry) => c.id === id ? { ...c, isReferenced: !c.isReferenced } : c);
        set({ chronicles: updated });
        const target = updated.find((c: ChronicleEntry) => c.id === id);
        if (target) await db.saveChronicle(target);
    },
});
