import { AppMode, Period, GeminiModel } from './enums';
import { CharacterProfile } from './character';
import { ChronicleEntry, StoryParams } from './story';
import { MemoryEntry } from './memory';

export type ActionType = 'STORY_GEN' | 'CHRONICLE_WRITE' | 'CHAR_ANALYZE' | 'ADVISOR_CHAT';

/**
 * [PR #10 Update] RoutingMeta
 * 모델 라우팅 판단 근거, 승격 여부, 지연 시간 및 토큰 사용량을 기록하는 인터페이스입니다.
 */
export interface RoutingMeta {
  selectedModel: GeminiModel; // 최초 선택된 모델
  isEscalated: boolean; // 승격 발생 여부
  escalatedTo?: GeminiModel; // 승격된 모델 (보통 'pro')
  escalationReason?: string; // 품질 실패 사유 (규칙명)
  totalScore: number;
  reasons: string[];
  metrics: {
    inputChars: number;
    recallCount: number;
    recallTokens: number;
    actionType: ActionType;
  };
  isDeepRecall?: boolean; // [NEW] 딥리콜 활성화 여부
  latency?: {
    flash?: number;
    pro?: number;
    total: number;
  };
  usage?: {
    promptTokens: number;
    candidatesTokens: number;
    totalTokens: number;
  };
  sessionUsage: {
    proCount: number;
    limit: number;
  };
}

export interface Message {
  id: string;
  role: 'user' | 'model';
  content: string;
  text?: string; // Legacy field for older components
  image?: string; 
  timestamp: number;
  mode?: AppMode | 'advisor';
  model?: string;
  isHidden?: boolean;
  isStreaming?: boolean;
  // [PR #9] 라우팅 및 추후 분석을 위한 메타데이터 추가
  metadata?: {
    routing?: RoutingMeta;
    tokens?: number;
    isDirectEntry?: boolean;
  };
}

export interface ChatConfig {
  userName: string;
  systemInstruction: string;
}

/**
 * [PR #1] InstructionBlock
 * 지침의 우선순위와 태그를 관리하기 위한 인터페이스입니다.
 */
export interface InstructionBlock {
    priority: number;
    tag: string;
    content: string;
}

/**
 * [PR #8] OptimizedContext
 * 지능형 사서 엔진이 반환하는 정제된 컨텍스트 패키지입니다.
 */
export interface OptimizedContext {
  relevantChronicles: ChronicleEntry[];
  relevantMemories: MemoryEntry[];
  clippedHistory: Message[];
  referencedEpisodeContent?: string; // [NEW] 명시적 에피소드 참조 내용
  referencedCompendiumContent?: string; // [NEW] 명시적 견문록 참조 내용
  tokenUsage: {
    total: number;
    chronicle: number;
    memory: number;
    history: number;
  };
  complexityScore: number;
  routingHint: {
    forcePro: boolean;
    reason?: string;
  };
  isDeepRecall?: boolean; // [NEW] 딥리콜 활성화 여부
  lastFodlanDate?: string; // [NEW] 날짜 역주행 방지를 위한 직전 날짜 앵커
}

/**
 * [PR #9] RoutingDecision
 * 라우터가 반환하는 최종 결정 객체입니다.
 */
export interface RoutingDecision {
    selectedModel: GeminiModel;
    meta: RoutingMeta;
}

/**
 * [Phase 1 / PR #3 / PR #7 / PR #8 Update] NarrativeContext
 * sendMessageToGemini의 매개변수를 관리하기 위한 통합 객체 인터페이스입니다.
 */
export interface NarrativeContext {
    history: Message[]; // [PR #8] 이제 이 필드는 최적화된(clipped) 내역을 담습니다.
    newMessage: string;
    characters: CharacterProfile[];
    storyParams: StoryParams;
    modelType: GeminiModel;
    period: Period;
    customPrompt: string;
    image?: string;
    referencedChronicles?: ChronicleEntry[]; // 유저가 명시적으로 고정한 기록
    referencedEpisodeContent?: string; // [NEW] 명시적 에피소드 전체 내용 참조
    referencedCompendiumContent?: string; // [NEW] 명시적 견문록 내용 참조
    nextEpisode?: number;
    autoRecalledChronicles?: ChronicleEntry[]; // [PR #8] 점수 기반 소환된 연대기
    structuredMemories?: MemoryEntry[]; // [PR #8] 점수 기반 소환된 구조화된 기억
    isDeepRecall?: boolean; // [NEW] 딥리콜 활성화 여부
    lastFodlanDate?: string; // [NEW] 날짜 역주행 방지를 위한 직전 날짜 앵커
    relationshipMatrix?: string;
    isSessionReset?: boolean;
    onRetryStatus?: (msg: string) => void;
    // [PR #8] 최적화 메타데이터
    optimizationMetadata?: {
        tokenUsage: OptimizedContext['tokenUsage'];
        complexityScore: number;
    };
    // [PR #9] 라우팅 메타데이터 전달
    routingMeta?: RoutingMeta;
}

/**
 * [PR #10-D] ChatFlowResult
 * 채팅 핸들러의 실행 결과를 담는 객체입니다.
 */
export interface ChatFlowResult {
    userMessage: Message;
    modelMessage: Message;
    routingMeta: RoutingMeta;
}