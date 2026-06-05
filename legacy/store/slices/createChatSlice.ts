
import { StateCreator } from 'zustand';
import { Message, CharacterProfile, ChronicleEntry, RoutingMeta } from '../../types/index';
import { generateId } from '../../utils/textUtils';
import { advisorChat } from '../../services/geminiService';
import { PERIOD_CONTEXTS, STRICT_TERMINOLOGY, STYLE_GUIDELINES } from '../../core.constants';
import { executeChatFlow, executeRegenerationFlow } from '../../services/chat/chatHandler';
import { db } from '../../utils/db';
import { AppState, ChatSlice } from '../types';

export const createChatSlice: StateCreator<AppState, [], [], ChatSlice> = (set, get) => ({
    messages: [],
    editingMessageId: null,
    editingContent: null,
    regeneratingMessageId: null,
    advisorMessages: [],
    advisorInput: "",
    isAdvisorLoading: false,
    jumpToMessageId: null,
    isDirectEntryMode: false,
    proUsageCount: 0,

    setMessages: (msgs) => set({ messages: msgs }),
    setEditingMessageId: (id) => set({ editingMessageId: id }),
    setEditingContent: (content) => set({ editingContent: content }),
    setAdvisorMessages: (msgs) => set({ advisorMessages: msgs }),
    setAdvisorInput: (val) => set({ advisorInput: val }),
    setJumpToMessageId: (id) => set({ jumpToMessageId: id }),
    setIsDirectEntryMode: (val) => set({ isDirectEntryMode: val }),
    incrementProUsage: () => set(state => ({ proUsageCount: state.proUsageCount + 1 })),

    handleSendMessage: async () => {
        const { 
            inputValue, attachedImage, messages, showStatus, 
            setIsRecallActive, incrementProUsage, isDirectEntryMode,
            handleDirectEntry
        } = get();
        
        if (!inputValue.trim() && !attachedImage) return;

        // [Strategy: Mode Routing]
        // 직접 집필 모드인 경우 AI 생성을 건너뛰고 바로 메시지를 등록합니다.
        if (isDirectEntryMode) {
            await handleDirectEntry(inputValue);
            return;
        }

        // Phase 1: Optimistic Update (사용자 메시지 즉시 반영)
        const userMsg: Message = { 
            id: generateId(), 
            role: 'user', 
            content: inputValue, 
            image: attachedImage || undefined,
            timestamp: Date.now() 
        };

        set({ 
            messages: [...messages, userMsg],
            inputValue: "", 
            attachedImage: null, 
            isLoading: true 
        });

        try {
            // Phase 2: Compute AI Response
            // [Separation of Command] 핸들러로 비즈니스 로직 위임
            const result = await executeChatFlow(
                get(),
                userMsg,
                (msg) => showStatus(msg)
            );

            // [Session Hard Reset] 세션 초기화 신호가 사용되었으므로 해제
            if (get().isSessionReset) {
                set({ isSessionReset: false });
            }

            // Recall 활성화 여부 반영 (메타데이터 기반)
            setIsRecallActive(
                result.routingMeta.metrics.recallCount > 0 || !!result.routingMeta.isDeepRecall
            );

            // Pro 모델 사용 시 카운트 증가
            if (result.routingMeta.selectedModel === 'pro' || result.routingMeta.isEscalated) {
                incrementProUsage();
            }

            // Phase 3: Final Sync (AI 답변 추가)
            // 주의: executeChatFlow 실행 중에 messages가 변경되었을 수 있으므로 최신 상태를 참조
            set(state => ({ 
                messages: [...state.messages, result.modelMessage] 
            }));

        } catch (e) {
            console.error("[CHAT_SLICE] Message generation failed:", e);
            showStatus("기록 보관소와 통신이 끊겼습니다.");
            // 실패 시 로딩만 끄고 사용자 메시지는 남겨둠 (재시도 기회 제공)
        } finally {
            set({ isLoading: false, isRecallActive: false });
        }
    },

    handleDirectEntry: async (content: string) => {
        const { messages, showStatus } = get();
        
        try {
            const { getLastEpisodeNumber } = await import('../../services/chat/chatHandler');
            
            // [Strategy: Narrative Autonomy]
            // 유저가 직접 입력한 텍스트를 그대로 사용하되, 시스템 동기화를 위해 에피소드 번호만 추출합니다.
            const EPISODE_REGEX = /###\s*(\d+)화/;
            const match = content.match(EPISODE_REGEX);
            const episodeNum = match ? parseInt(match[1], 10) : getLastEpisodeNumber(messages) + 1;

            const modelMsg: Message = {
                id: generateId(),
                role: 'model',
                content: content,
                timestamp: Date.now(),
                metadata: {
                    isDirectEntry: true
                }
            };

            set(state => ({
                messages: [...state.messages, modelMsg],
                inputValue: "",
                isDirectEntryMode: false // 입력 후 모드 해제
            }));

            showStatus(`제${episodeNum}화 서사가 직접 기록되었습니다.`);

            // [Stable-Sync] 참여도 및 기억 동기화
            const { syncMemoriesForEpisode } = await import('../../services/geminiService');
            const { updateCharacterInvolvement } = await import('../../services/chat/chatHandler');
            
            await updateCharacterInvolvement(content, episodeNum, get());
            syncMemoriesForEpisode([...messages, modelMsg], episodeNum);

        } catch (e) {
            console.error("[DIRECT_ENTRY] Failed:", e);
            showStatus("서사 기록 중 오류가 발생했습니다.");
        }
    },

    handleStartEdit: (msg) => {
        set({ editingMessageId: msg.id, editingContent: msg.content });
    },

    handleSaveEdit: async (msgId) => {
        const { editingContent, messages } = get();
        if (editingContent === null) return;
        
        const updated = messages.map((m: Message) => m.id === msgId ? { ...m, content: editingContent } : m);
        set({ messages: updated, editingMessageId: null, editingContent: null });

        // [Stable-Sync] 인과율 동기화 프로세스
        const EPISODE_REGEX = /###\s*(\d+)화/;
        const match = editingContent.match(EPISODE_REGEX);
        
        if (match) {
            const episodeNum = parseInt(match[1], 10);
            const msgIdx = updated.findIndex(m => m.id === msgId);
            const contextForExtraction = updated.slice(0, msgIdx + 1);
            
            // 삭제와 추출이 태스크 큐 내부에서 순차적으로 처리됨
            const { syncMemoriesForEpisode } = await import('../../services/gemini/memoryEngine');
            syncMemoriesForEpisode(contextForExtraction, episodeNum);
        }
    },

    handleRegenerateResponse: async (msgId) => {
        const { 
            messages, showStatus, setIsRecallActive, incrementProUsage
        } = get();
        
        const msgIdx = messages.findIndex((m: Message) => m.id === msgId);
        if (msgIdx === -1) return;

        set({ regeneratingMessageId: msgId });

        try {
            // [Separation of Command] 재생성 핸들러 호출
            const result = await executeRegenerationFlow(
                get(),
                msgId,
                (msg) => showStatus(msg)
            );

            // [Session Hard Reset] 세션 초기화 신호가 사용되었으므로 해제
            if (get().isSessionReset) {
                set({ isSessionReset: false });
            }

            setIsRecallActive(result.routingMeta.metrics.recallCount > 0 || !!result.routingMeta.isDeepRecall);
            
            if (result.routingMeta.selectedModel === 'pro' || result.routingMeta.isEscalated) {
                incrementProUsage();
            }

            const updated = messages.map((m: Message) => m.id === msgId ? result.modelMessage : m);
            set({ messages: updated });

        } catch (e) {
            console.error("[CHAT_SLICE] Regeneration failed:", e);
            showStatus("인과의 뒤틀림이 발생하여 재생성에 실패했습니다.");
        } finally {
            set({ regeneratingMessageId: null, isRecallActive: false });
        }
    },

    handleDeleteMessage: async (msgId) => {
        const { messages } = get();
        const msgIdx = messages.findIndex((m: Message) => m.id === msgId);
        if (msgIdx === -1) return;

        // [Strategy: Individual Deletion]
        // 유저에게 편집의 자유도를 부여하기 위해 페어 삭제를 중단하고 개별 메시지만 삭제합니다.
        const targetMsg = messages[msgIdx];
        
        // 삭제 전 해당 메시지가 속한 에피소드 번호 파악 (인과율 재계산을 위함)
        const EPISODE_REGEX = /###\s*(\d+)화/;
        let episodeNum = 0;
        for (let i = msgIdx; i >= 0; i--) {
            const match = messages[i].content.match(EPISODE_REGEX);
            if (match) {
                episodeNum = parseInt(match[1], 10);
                break;
            }
        }

        const updated = messages.filter((m: Message) => m.id !== msgId);
        set({ messages: updated });

        // [Data Integrity] 삭제 후 해당 에피소드의 기억 재스캔 (유령 기억 방지)
        if (episodeNum > 0) {
            const { syncMemoriesForEpisode } = await import('../../services/geminiService');
            // 삭제된 메시지가 반영된 최신 상태를 기반으로 기억을 재구성합니다.
            // 해당 에피소드 시점까지의 맥락을 전달하여 기억을 갱신합니다.
            const contextForRescan = updated.slice(0, msgIdx + 1);
            syncMemoriesForEpisode(contextForRescan, episodeNum);
        }
        
        // [PO's SPEC] 삭제 시 발생하는 안내 토스트(showStatus)를 제거하여 쾌적한 UX 제공
    },

    handleDeleteImageOnly: async (msgId) => {
        const { messages } = get();
        const updated = messages.map((m: Message) => m.id === msgId ? { ...m, image: undefined } : m);
        set({ messages: updated });
    },

    handleAskAdvisor: async () => {
        const { advisorInput, advisorMessages, characters, period, chronicles, compendium, messages } = get();
        if (!advisorInput.trim()) return;

        const userMsg: Message = { id: generateId(), role: 'user', content: advisorInput, timestamp: Date.now() };
        const newHistory = [...advisorMessages, userMsg];
        set({ advisorMessages: newHistory, advisorInput: "", isAdvisorLoading: true });

        try {
            // [Deep Recall] 고문에게도 에피소드/견문록 참조 기능 부여
            const { getOptimizedContext } = await import('../../services/gemini/contextOptimizer');
            const { getLastEpisodeNumber } = await import('../../services/chat/chatHandler');
            
            const lastEp = getLastEpisodeNumber(messages);
            const optimized = await getOptimizedContext(advisorInput, get(), lastEp);

            // [PO's SPEC] 유닛 상세 정보(능력치) 제외, 프로필만 제공
            const activeUnitsInfo = characters
                .filter((c: CharacterProfile) => c.isActive)
                .map((c: CharacterProfile) => {
                    return `- ${c.name}: ${c.description.substring(0, 200)}...`;
                })
                .join('\n');

            const chronicleSummary = chronicles
                .slice(-10)
                .map((c: ChronicleEntry) => `[${c.range}] ${c.title}: ${c.summary.substring(0, 100)}...`)
                .join('\n');

            const recentNarrative = messages
                .slice(-15)
                .map((m: Message) => `[${m.role === 'user' ? 'USER' : 'STORY'}] ${m.content}`)
                .join('\n');

            const worldContext = {
                activeUnits: activeUnitsInfo || "활성화된 유닛 없음",
                chronicleSummary: chronicleSummary || "기록된 연대기 없음",
                recentNarrative: recentNarrative || "진행된 서사 없음",
                guidelines: `${STRICT_TERMINOLOGY}\n${STYLE_GUIDELINES}`,
                period: period ? PERIOD_CONTEXTS[period as keyof typeof PERIOD_CONTEXTS] : "시점 불명",
                compendium: compendium,
                referencedEpisodeContent: optimized.referencedEpisodeContent,
                referencedCompendiumContent: optimized.referencedCompendiumContent
            };

            const response = await advisorChat(advisorMessages, advisorInput, worldContext);
            const modelMsg: Message = { id: generateId(), role: 'model', content: response, timestamp: Date.now() };
            set({ advisorMessages: [...newHistory, modelMsg] });
        } catch (e) {
            console.error("Advisor failed to answer", e);
        } finally {
            set({ isAdvisorLoading: false });
        }
    }
});
