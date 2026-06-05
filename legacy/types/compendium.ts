
export interface CompendiumSection {
  subtitle: string;
  content: string;
}

// [Fix] Added missing CompendiumFragment interface to resolve export error in types/index.ts
export interface CompendiumFragment {
  category: string;
  text: string;
}

export interface CompendiumEntry {
  id: string;
  title: string;
  sections: CompendiumSection[];
  // [Fix] Added fragments array as it is accessed in the prompt builder logic and required by types
  fragments: CompendiumFragment[];
  isPinned: boolean;
  timestamp: number;
  order: number; // [Phase DnD] 정렬 순서 보존 필드
}
