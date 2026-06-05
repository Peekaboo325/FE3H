import React from 'react';
import { Bot } from 'lucide-react';

const TypingIndicator: React.FC = () => {
  return (
    <div className="flex w-full justify-start mb-6 animate-fade-in">
      <div className="flex gap-3">
        <div className="flex-shrink-0 w-8 h-8 md:w-10 md:h-10 rounded-full bg-white text-indigo-600 border border-indigo-100 flex items-center justify-center shadow-sm">
          <Bot size={18} />
        </div>
        <div className="bg-white border border-slate-100 px-4 py-4 rounded-2xl rounded-tl-sm shadow-sm flex items-center gap-1">
          <div className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
          <div className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
          <div className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce"></div>
        </div>
      </div>
    </div>
  );
};

export default TypingIndicator;
