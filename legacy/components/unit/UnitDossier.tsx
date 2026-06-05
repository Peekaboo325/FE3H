
import React from 'react';
import { CharacterProfile, BondRecord } from '../../types/index';
import { ThumbnailPlaceholder, MarkdownContent, FodlanPortrait } from '../SharedComponents';
import { BondSection } from './BondSection';
import { Badge } from '../ui/Badge';
import { Card } from '../ui/Card';
import { useAppStore } from '../../store/useAppStore';
import { extractFirstName } from '../../utils/textUtils';

interface UnitDossierProps {
  character: CharacterProfile;
  displayQuote?: string;
  isAutoQuote: boolean;
}

export const UnitDossier: React.FC<UnitDossierProps> = ({ character, displayQuote, isAutoQuote }) => {
  const { characters, handleUpdateCharacter } = useAppStore();

  const handleBondReorder = (newBonds: BondRecord[]) => {
      handleUpdateCharacter({
          ...character,
          bonds: newBonds
      });
  };

  // [PO's PROTOCOL] 인물의 격식을 위해 헤더에 풀네임(FullName)을 우선 노출하도록 수정
  const fullName = character.name;

  return (
    <div className="relative animate-in fade-in duration-500">
      {/* Header Section: Avatar and Identity */}
      <div className="flex flex-col md:flex-row gap-5 md:gap-8 px-6 md:px-10 pt-8 pb-6 bg-white dark:bg-[#121214] border-b border-gray-100 dark:border-gray-800">
        <div className="shrink-0 w-full md:w-auto flex flex-col items-center">
          <div className="w-32 h-32 md:w-36 md:h-36 rounded-full border-4 border-white dark:border-[#1c1c1f] shadow-xl bg-gray-200 dark:bg-gray-800 relative">
            <FodlanPortrait 
                src={character.thumbnail} 
                size="full"
                alt={fullName}
                className={`${character.life_status === 'deceased' ? 'grayscale contrast-125' : ''} ${character.life_status === 'unknown' ? 'grayscale brightness-50' : ''}`}
            />
            {character.life_status === 'deceased' && <div className="absolute inset-0 border-4 border-red-500/30 rounded-full pointer-events-none" />}
            {character.life_status === 'unknown' && <div className="absolute inset-0 flex items-center justify-center bg-black/20 rounded-full"><span className="text-white/80 text-3xl font-bold">?</span></div>}
          </div>
          
          {character.current_location && (
            <div className="hidden md:flex items-center gap-1.5 mt-4 text-[10px] text-gray-400 font-medium uppercase tracking-widest opacity-80">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-3.5 h-3.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0Z" />
              </svg>
              <span>{character.current_location}</span>
            </div>
          )}
        </div>
        
        <div className="flex-1 min-w-0 flex flex-col justify-center items-center md:items-start text-center md:text-left gap-2 pt-1 w-full">
          <div className="flex items-center justify-center md:justify-start gap-3 mb-0 flex-wrap">
            <h1 className="text-2xl md:text-3xl font-bold font-sans text-gray-900 dark:text-gray-100 tracking-tight break-keep text-balance">
                {fullName}
            </h1>
          </div>

          {displayQuote && (
            <div className="flex items-start justify-center md:justify-start gap-2 text-xs md:text-sm text-gray-600 dark:text-gray-400 italic mt-1 mb-1 max-w-xl mx-auto md:mx-0">
              <span className="text-gray-400 not-italic font-sans text-lg leading-none shrink-0 mt-0.5 select-none">“</span>
              <span className={`break-keep text-balance leading-relaxed ${isAutoQuote ? 'text-gray-500 dark:text-gray-500' : ''}`}>
                {displayQuote}
              </span>
              <span className="text-gray-400 not-italic font-sans text-lg leading-none shrink-0 mt-0.5 select-none">”</span>
            </div>
          )}
          
          <div className="flex flex-wrap justify-center md:justify-start gap-2 mb-2">
            {character.aliases && character.aliases.length > 0 && (
              character.aliases.map((alias, i) => (
                <Badge key={i} variant="primary">
                  {alias}
                </Badge>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="p-6 md:p-10 bg-gray-50/30 dark:bg-black/20 space-y-12">
        {/* Personal Dossier */}
        <div className="max-w-3xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
          <div className="flex items-center justify-between mb-2 opacity-70 border-b border-gray-100 dark:border-gray-800 pb-2">
            <h3 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest font-sans">Personal Dossier</h3>
          </div>
          <Card className="min-h-[160px] flex flex-col" padding="lg">
            {character.description ? (
              <MarkdownContent content={character.description} variant="compact" />
            ) : (
              <div className="flex-1 flex items-center justify-center">
                <span className="text-[10px] text-gray-400">설정 정보가 없습니다.</span>
              </div>
            )}
          </Card>
        </div>

        {/* Bonds Section */}
        <div className="max-w-3xl mx-auto">
            <BondSection bonds={character.bonds || []} characters={characters} onReorder={handleBondReorder} />
        </div>
      </div>
    </div>
  );
};
