
export type LetterType = 'letter' | 'note' | 'official' | 'invitation' | 'petition' | 'warning' | 'will';

export type LetterStatus = 'sent' | 'draft';

export interface Letter {
  id: string;
  senderId: string;
  receiverId: string;
  type: LetterType;
  status: LetterStatus;
  title: string;
  content: string;
  signature: string;
  timestamp: number; // Narrative date representation or real timestamp? 
                     // Roadmap says "timestamp based on creation" but "narrative date" in content.
                     // We'll use real timestamp for sorting, and AI will generate narrative date string.
  isSealed: boolean;
  replyToId?: string; // ID of the letter this is replying to
  recipient_name?: string; // [Option 1] AI-extracted title or name for the recipient
}
