import React from 'react';
import { BotMessageSquare } from 'lucide-react';

const Header: React.FC = () => {
  return (
    <header className="sticky top-0 z-10 bg-slate-950/80 backdrop-blur-md border-b border-slate-800/50">
      <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-cyan-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-cyan-900/20">
            <BotMessageSquare className="text-white" size={24} />
          </div>
          <div>
            <h1 className="font-bold text-lg text-slate-100 tracking-tight">ChatbotChatbot</h1>
            <p className="text-xs text-slate-400 font-medium flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
              Online
            </p>
          </div>
        </div>
        
        <div className="hidden sm:flex items-center gap-4">
          <a href="#" className="text-xs text-slate-500 hover:text-cyan-400 transition-colors">Documentation</a>
          <a href="#" className="text-xs text-slate-500 hover:text-cyan-400 transition-colors">About</a>
        </div>
      </div>
    </header>
  );
};

export default Header;
