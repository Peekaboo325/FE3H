
export { 
  sendMessageToGemini, 
  buildNovelSystemInstruction, 
  calculateTimeGap 
} from './gemini/novelEngine';

export { 
  analyzeCharacter, 
  generateChronicle 
} from './gemini/analysisEngine';

export { 
  advisorChat,
  getTacticalAdvice
} from './gemini/advisorEngine';

export {
  extractMemoriesFromNarrative,
  syncMemoriesForEpisode
} from './gemini/memoryEngine';

export {
    recommendEnglishName,
    classifyBondTheme
} from './gemini/analyzers/characterAnalyzer';

export {
    refineCompendiumText
} from './gemini/analyzers/compendiumRefiner';

export {
    letterEngine
} from './gemini/letterEngine';

import * as novel from './gemini/novelEngine';
import * as analysis from './gemini/analysisEngine';
import * as advisor from './gemini/advisorEngine';
import * as memory from './gemini/memoryEngine';
import { recommendEnglishName, classifyBondTheme } from './gemini/analyzers/characterAnalyzer';
import { refineCompendiumText } from './gemini/analyzers/compendiumRefiner';
import { letterEngine } from './gemini/letterEngine';

export const geminiService = {
    ...novel,
    ...analysis,
    ...advisor,
    ...memory,
    recommendEnglishName,
    classifyBondTheme,
    refineCompendiumText,
    ...letterEngine
};
