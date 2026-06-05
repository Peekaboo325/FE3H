
import { QuestType } from './enums';

export type BondTheme = 'rose' | 'crimson' | 'emerald' | 'azure' | 'violet' | 'amber' | 'slate';

export interface BondRecord {
  id: string;
  name: string;          // 대상의 국문명 (예: 에블린 오딜 마테우스)
  english_name?: string;  // 대상의 영문명 (예: Evelin Odill Mateus - 매칭 고도화용)
  category: string;      // 관계 분류 (예: 약혼녀, 소꿉친구)
  description: string;   // 관계 상세 설명
  level?: 'S' | 'A' | 'B' | 'C'; // [NEW] 인연 등급 (S, A, B, C)
  order: number;
  theme?: BondTheme;     // [Phase AI-Label] AI가 판단한 시각적 테마
  life_status?: 'alive' | 'deceased' | 'unknown'; // [NEW] 인연의 생사 상태 (날짜 입력 없음)
}

export interface CharacterStats {
  prowess: number;
  magic: number;
  faith: number;
  intellect: number;
  influence: number;
  status: number;
  wealth: number;
  charm: number;
  resilience: number;
}

export interface CharacterStatsComments {
  prowess: string;
  magic: string;
  faith: string;
  intellect: string;
  influence: string;
  status: string;
  wealth: string;
  charm: string;
  resilience: string;
}

export interface ReputationItem {
  source: string;
  category: string;
  comment: string;
}

export interface BelongingItem {
  stableId: string; 
  name: string;
  emoji: string;
  comment: string;
  isNew?: boolean; 
}

export interface QuestItem {
  type: QuestType;
  name: string;
  description: string;
  reward: string;
}

export interface CharacterAnalysis {
  analyzed_name: string;
  analyzed_english_name?: string; 
  title: string;
  hashtags: string[];
  stats: CharacterStats;
  stat_comments?: CharacterStatsComments;
  personality_analysis: string;
  unconscious_analysis: string;
  reputation: ReputationItem[];
  quests?: QuestItem[];
  belongings?: BelongingItem[];
  generated_quote?: string; 
  bond_themes?: Record<string, BondTheme>; // [Phase AI-Label] 인연별 분석된 테마 맵
  timestamp: number;
}

export interface CharacterProfile {
  id: string;
  stableId?: string; 
  name: string;
  english_name?: string; 
  aliases?: string[];
  description: string;
  thumbnail?: string;
  isActive: boolean;
  life_status?: 'alive' | 'deceased' | 'unknown';
  deceased_date?: string; 
  
  current_location?: string; 
  signature_quote?: string; 
  
  order?: number; // [PR #Order-Fix] 목록 정렬 순서 보존용 필드

  // [Narrative Isolation Engine]
  last_appearance_ep?: number; // 직접 출연(대사/행동) 회차
  last_mention_ep?: number;    // 간접 언급/묘사 회차
  is_exited?: boolean;         // 명시적 서사 퇴장 여부
  hasSentWill?: boolean;       // [NEW] 유서 발송 완료 여부 (사망 시 1회 한정)

  analysis?: CharacterAnalysis;
  
  bonds?: BondRecord[];
}
