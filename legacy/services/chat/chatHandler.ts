
import { AppState } from '../../store/types';
import { 
    Message, 
    NarrativeContext, 
    ChronicleEntry, 
    ChatFlowResult,
    RoutingMeta,
    CharacterProfile
} from '../../types/index';
import { generateId, extractFirstName } from '../../utils/textUtils';
import { sendMessageToGemini, syncMemoriesForEpisode } from '../geminiService';
import { extractRelationshipMatrix } from '../../utils/resonanceUtils';
import { getOptimizedContext } from '../gemini/contextOptimizer';
import { determineRouting } from '../gemini/router';
import { db } from '../../utils/db';

const EPISODE_REGEX = /###\s*(\d+)화/;
const DATE_SUB_REGEX = /<sub>제국력\s*(\d+년\s*[가-힣]+의\s*달\s*\d+일)/;
const PULSE_TRIGGER_TAG = "[SYSTEM: PULSE_TRIGGER]";

export const getLastEpisodeNumber = (messages: Message[]): number => {
    for (let i = messages.length - 1; i >= 0; i--) {
        const msg = messages[i];
        if (msg.role === 'model' && !msg.isHidden) {
            const match = msg.content.match(EPISODE_REGEX);
            if (match) return parseInt(match[1], 10);
        }
    }
    return 0;
};

export const getLastFodlanDate = (messages: Message[]): string | undefined => {
    for (let i = messages.length - 1; i >= 0; i--) {
        const msg = messages[i];
        if (msg.role === 'model' && !msg.isHidden) {
            const match = msg.content.match(DATE_SUB_REGEX);
            if (match) return match[1].trim();
        }
    }
    return undefined;
};

/**
 * [Narrative Isolation] 답변 내 캐릭터 출연 및 언급 자동 감지
 */
export const updateCharacterInvolvement = async (content: string, episodeNum: number, state: AppState) => {
    const { characters, handleUpdateCharacter } = state;
    
    for (const char of characters) {
        const firstName = extractFirstName(char.name);
        const nameCandidates = [char.name, firstName, ...(char.aliases || [])].filter(n => n.length >= 2);
        
        // 1. 직접 출연 (Appearance) 감지: "이름:" 형태의 대사 라인 검색
        const appearanceRegex = new RegExp(`^(${nameCandidates.join('|')})\\s*:`, 'm');
        const hasAppeared = appearanceRegex.test(content);

        // 2. 간접 언급 (Mention) 감지: 텍스트 내 이름 존재 여부
        const mentionRegex = new RegExp(`(${nameCandidates.join('|')})`, 'g');
        const hasMentioned = mentionRegex.test(content);

        if (hasAppeared) {
            await handleUpdateCharacter({ ...char, last_appearance_ep: episodeNum, last_mention_ep: episodeNum });
        } else if (hasMentioned) {
            await handleUpdateCharacter({ ...char, last_mention_ep: episodeNum });
        }
    }
};

/**
 * [Optimistic Update Support]
 * Slice에서 미리 생성된 userMsg를 받아 서사 생성을 처리합니다.
 */
export const executeChatFlow = async (
    state: AppState,
    userMsg: Message,
    onRetryStatus?: (msg: string) => void
): Promise<ChatFlowResult> => {
    
    const { 
        messages, characters, storyParams, period, 
        customPrompt, chronicles, proUsageCount, compendium,
        isSessionReset
    } = state;

    const input = userMsg.content;
    const image = userMsg.image;

    const lastEpisode = getLastEpisodeNumber(messages);
    const nextEpNum = lastEpisode + 1;
    const lastDate = getLastFodlanDate(messages);

    (window as any).indexedDB_allMemories = await db.getAllMemories();
    
    // [PR #Narrative-2.0] 최적화 엔진 가동
    const optimized = await getOptimizedContext(input, state, nextEpNum);

    const referencedChronicles = chronicles.filter((c: ChronicleEntry) => c.isReferenced);
    const routing = determineRouting(
        input, 
        optimized, 
        'STORY_GEN', 
        proUsageCount, 
        referencedChronicles.length > 0
    );

    const relationshipMatrix = extractRelationshipMatrix(chronicles);

    // [PR #Narrative-2.0] 세렌디피티 시드 추출 및 지침 보강
    const serendipitySeed = (window as any).nextSerendipitySeed;
    const finalCustomPrompt = serendipitySeed 
        ? `${customPrompt}\n\n${serendipitySeed}` 
        : customPrompt;
    (window as any).nextSerendipitySeed = null; // 사용 후 제거

    // 라우팅 메타데이터에 딥리콜 여부 주입
    routing.meta.isDeepRecall = optimized.isDeepRecall;

    const context: NarrativeContext = {
        history: optimized.clippedHistory,
        newMessage: input,
        characters,
        storyParams,
        modelType: routing.selectedModel,
        period: period!,
        customPrompt: finalCustomPrompt,
        image: image,
        referencedChronicles,
        referencedEpisodeContent: optimized.referencedEpisodeContent,
        referencedCompendiumContent: optimized.referencedCompendiumContent,
        nextEpisode: nextEpNum,
        autoRecalledChronicles: optimized.relevantChronicles,
        structuredMemories: optimized.relevantMemories,
        isDeepRecall: (optimized as any).isDeepRecall,
        lastFodlanDate: lastDate,
        relationshipMatrix,
        isSessionReset,
        onRetryStatus,
        optimizationMetadata: {
            tokenUsage: optimized.tokenUsage,
            complexityScore: optimized.complexityScore
        },
        routingMeta: routing.meta
    };

    // [PR #Narrative-2.0] 엔진 2.0에서 선별된 기저 정보 합산
    const baseCompendium = (optimized as any).injectedAtmosphere || [];
    const fullCompendium = Array.from(new Set([...baseCompendium, ...compendium]));
    (context as any).compendium = fullCompendium;

    let response = await sendMessageToGemini(context);

    if (response.includes(PULSE_TRIGGER_TAG)) {
        onRetryStatus?.("운명의 박동이 공명하고 있습니다...");
        response = response.replace(PULSE_TRIGGER_TAG, "").trim();
    }

    const modelMsg: Message = { 
        id: generateId(), 
        role: 'model', 
        content: response, 
        timestamp: Date.now(),
        metadata: {
            routing: routing.meta
        }
    };

    // [Narrative Isolation] 참여도 추적 실행
    await updateCharacterInvolvement(response, nextEpNum, state);

    // [Stable-Sync] 비동기 기억 추출 (Queue 적용)
    syncMemoriesForEpisode([...messages, modelMsg], nextEpNum);

    return {
        userMessage: userMsg,
        modelMessage: modelMsg,
        routingMeta: routing.meta
    };
};

export const executeRegenerationFlow = async (
    state: AppState,
    targetMsgId: string,
    onRetryStatus?: (msg: string) => void
): Promise<{ modelMessage: Message; routingMeta: RoutingMeta }> => {

    const { 
        messages, characters, storyParams, period, 
        customPrompt, chronicles, proUsageCount, compendium,
        isSessionReset
    } = state;

    const msgIdx = messages.findIndex((m: Message) => m.id === targetMsgId);
    if (msgIdx === -1) throw new Error("Target message not found");

    const contextMessages = messages.slice(0, msgIdx);
    const lastUserMsg = contextMessages.filter((m: Message) => m.role === 'user').pop();
    if (!lastUserMsg) throw new Error("No user message found to regenerate from");

    const currentMsg = messages[msgIdx];
    const match = currentMsg.content.match(EPISODE_REGEX);
    const targetEpisode = match ? parseInt(match[1], 10) : getLastEpisodeNumber(contextMessages) + 1;
    const lastDate = getLastFodlanDate(contextMessages);

    (window as any).indexedDB_allMemories = await db.getAllMemories();
    const optimized = await getOptimizedContext(
        lastUserMsg.content, 
        { ...state, messages: contextMessages }, 
        targetEpisode
    );

    const referencedChronicles = chronicles.filter((c: ChronicleEntry) => c.isReferenced);
    const routing = determineRouting(
        lastUserMsg.content, 
        optimized, 
        'STORY_GEN', 
        proUsageCount, 
        referencedChronicles.length > 0
    );

    const relationshipMatrix = extractRelationshipMatrix(chronicles);

    // 라우팅 메타데이터에 딥리콜 여부 주입
    routing.meta.isDeepRecall = optimized.isDeepRecall;

    const context: NarrativeContext = {
        history: optimized.clippedHistory,
        newMessage: lastUserMsg.content,
        characters,
        storyParams,
        modelType: routing.selectedModel,
        period: period!,
        customPrompt,
        image: lastUserMsg.image,
        referencedChronicles,
        referencedEpisodeContent: optimized.referencedEpisodeContent,
        referencedCompendiumContent: optimized.referencedCompendiumContent,
        nextEpisode: targetEpisode,
        autoRecalledChronicles: optimized.relevantChronicles,
        structuredMemories: optimized.relevantMemories,
        isDeepRecall: (optimized as any).isDeepRecall,
        lastFodlanDate: lastDate,
        relationshipMatrix,
        isSessionReset,
        onRetryStatus,
        optimizationMetadata: {
            tokenUsage: optimized.tokenUsage,
            complexityScore: optimized.complexityScore
        },
        routingMeta: routing.meta
    };

    const baseCompendium = (optimized as any).injectedAtmosphere || [];
    const fullCompendium = Array.from(new Set([...baseCompendium, ...compendium]));
    (context as any).compendium = fullCompendium;

    let response = await sendMessageToGemini(context);

    if (response.includes(PULSE_TRIGGER_TAG)) {
        onRetryStatus?.("운명의 박동이 다시 공명합니다...");
        response = response.replace(PULSE_TRIGGER_TAG, "").trim();
    }

    const modelMsg: Message = { 
        id: generateId(), 
        role: 'model', 
        content: response, 
        timestamp: Date.now(),
        metadata: {
            routing: routing.meta
        }
    };

    // [Narrative Isolation] 참여도 추적 실행
    await updateCharacterInvolvement(response, targetEpisode, state);

    // [Stable-Sync] 재생성 시에도 이전 기억을 삭제하고 새 기억을 추출 (Queue 적용)
    syncMemoriesForEpisode([...contextMessages, modelMsg], targetEpisode);

    return {
        modelMessage: modelMsg,
        routingMeta: routing.meta
    };
};
