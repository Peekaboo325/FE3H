
import React from 'react';

interface LayoutProps {
  children: React.ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({ children }) => {
  return (
    <div className="min-h-screen w-full flex flex-col bg-neutral-950 text-neutral-200 overflow-hidden relative">
      {/* Tactical Background Layer */}
      <div className="absolute inset-0 tactical-grid opacity-10 pointer-events-none"></div>
      
      {/* Main Container */}
      <div className="flex-1 flex overflow-hidden z-10 relative">
        {children}
      </div>

      {/* Decorative Border */}
      <div className="absolute inset-0 pointer-events-none border-[12px] border-neutral-900/50"></div>
      <div className="absolute inset-2 pointer-events-none border border-gold/20"></div>
    </div>
  );
};
