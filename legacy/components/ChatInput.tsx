import React, { useState, useRef, useEffect } from 'react';
import { SendHorizontal, ArrowUp, PenTool } from 'lucide-react';
import Button from './ui/Button';
import { useAppStore } from '../store/useAppStore';

interface ChatInputProps {
  onSend: (message: string) => void;
  isLoading: boolean;
}

const ChatInput: React.FC<ChatInputProps> = ({ onSend, isLoading }) => {
  const [text, setText] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { isDirectEntryMode, setIsDirectEntryMode } = useAppStore();

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }
  }, [text]);

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!text.trim() || isLoading) return;
    
    onSend(text);
    setText('');
    
    // Reset height
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
    if (e.key === 'Enter' && !e.shiftKey && !isMobile) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto p-4 bg-white/80 backdrop-blur-md border-t border-slate-100">
      <div className={`relative flex items-center gap-2 border rounded-3xl px-4 py-2 shadow-sm transition-all ${isDirectEntryMode ? 'bg-blue-50/50 border-blue-200 ring-2 ring-blue-100' : 'bg-slate-50 border-slate-200 focus-within:ring-2 focus-within:ring-indigo-100 focus-within:border-indigo-300'}`}>
        <button 
          onClick={() => setIsDirectEntryMode(!isDirectEntryMode)}
          className={`p-2 h-10 w-10 flex items-center justify-center rounded-full transition-all shrink-0 ${isDirectEntryMode ? 'text-blue-600 bg-blue-100 scale-110' : 'text-slate-400 hover:bg-slate-200 hover:text-slate-600'}`}
          title={isDirectEntryMode ? "직접 집필 모드 활성 (AI 생성을 건너뜁니다)" : "직접 집필 모드로 전환"}
        >
          <PenTool size={18} strokeWidth={isDirectEntryMode ? 2.5 : 2} />
        </button>
        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={isDirectEntryMode ? "서사를 직접 입력하세요 (AI 생성을 건너뜁니다)..." : "메시지를 입력하세요..."}
          className="flex-1 max-h-[120px] bg-transparent border-0 focus:ring-0 resize-none py-2 text-slate-800 placeholder:text-slate-400 leading-6"
          rows={1}
          disabled={isLoading}
        />
        <Button
          onClick={() => handleSubmit()}
          disabled={!text.trim() || isLoading}
          variant={isDirectEntryMode ? "primary" : "primary"}
          size="icon"
          className={`rounded-full h-10 w-10 shrink-0 shadow-sm transition-all ${isDirectEntryMode ? 'bg-blue-600 hover:bg-blue-700' : ''}`}
          aria-label="Send message"
        >
          {isLoading ? (
             <div className="w-2 h-2 bg-white rounded-full animate-ping" />
          ) : (
            isDirectEntryMode ? <SendHorizontal size={18} strokeWidth={2.5} /> : <ArrowUp size={20} strokeWidth={2.5} />
          )}
        </Button>
      </div>
      <p className="text-center text-[10px] text-slate-400 mt-2 uppercase tracking-widest font-bold">
        {isDirectEntryMode ? "NARRATIVE IMPORT MODE ACTIVE" : "Gemini can make mistakes. Check important info."}
      </p>
    </div>
  );
};

export default ChatInput;