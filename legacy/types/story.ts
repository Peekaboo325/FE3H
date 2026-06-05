
export interface StoryParams {
  sensuality: number;
  speed: number;
}

export interface ChronicleKeyword {
  keyword: string;
  significance: string;
}

export interface StoryMemory {
  key_events: string[];
  status: string;
  items_and_keywords: ChronicleKeyword[];
  unsolved_mysteries: string[];
  absolute_rules: string;
}

export interface StateChangeItem {
  category: string; // '인물', '관계', '장소', '정보'
  content: string;
}

export interface DialogueItem {
  speaker: string;
  line: string;
}

// [v3.0] Categorized Tag Structure
export interface ChronicleTags {
  person: string[];
  place: string[];
  topic: string[];
  item: string[];
  sentiment: string[];
}

export interface ChronicleEntry {
  id: string;
  range: string; // e.g., "제1장 (1화 ~ 10화)"
  title: string; // e.g., "서막: 여신의 계시"
  summary: string; // Dry facts
  
  // [v2.0 New Structured Data]
  state_changes?: StateChangeItem[]; 
  major_dialogues?: DialogueItem[];
  
  // [v3.0 Tag System]
  tags?: ChronicleTags; 

  // Legacy support
  emotion?: string; // Deprecated by tags.sentiment
  seeds?: string[]; 
  key_events: string[]; 
  keywords: string[]; // Deprecated by tags.*
  
  contained_episodes?: number[]; // [Internal DB] List of episode numbers found
  date: string; // Narrative Date string
  timestamp: number; // Created time
  startMessageId?: string; // For Jump
  endMessageId?: string;
  isReferenced?: boolean; // Context Injection Flag
}
