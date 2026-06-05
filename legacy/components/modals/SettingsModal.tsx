
import React from 'react';
import { StepSlider } from '../SharedComponents';
import { useAppStore } from '../../store/useAppStore';
import { IconButton } from '../ui/IconButton';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const ProtocolCard: React.FC<{
    title: string;
    description: string;
    isActive: boolean;
    onToggle: () => void;
}> = ({ title, description, isActive, onToggle }) => (
    <div 
        className={`p-4 border transition-all duration-300 rounded-sm relative overflow-hidden flex items-center justify-between ${
            isActive 
            ? 'border-blue-500/50 bg-blue-50/10 dark:bg-blue-900/5 shadow-[0_0_15px_rgba(59,130,246,0.1)]' 
            : 'border-gray-100 dark:border-gray-800 bg-gray-50/30 dark:bg-transparent'
        }`}
    >
        <div className="flex-1 pr-4">
            <h5 className={`text-[10px] font-bold uppercase tracking-widest mb-1 ${isActive ? 'text-blue-600 dark:text-blue-400' : 'text-gray-400'}`}>
                {title}
            </h5>
            <p className="text-[9px] text-gray-500 dark:text-gray-500 leading-relaxed break-keep">
                {description}
            </p>
        </div>
        <button 
            onClick={onToggle}
            className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${isActive ? 'bg-blue-600' : 'bg-gray-200 dark:bg-gray-700'}`}
            role="switch"
            aria-checked={isActive}
        >
            <span className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${isActive ? 'translate-x-4' : 'translate-x-0'}`} />
        </button>
    </div>
);

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose }) => {
  const { 
    storyParams, setStoryParams, 
    customPrompt, setCustomPrompt,
    useAtmosphereInfiltration, setUseAtmosphereInfiltration,
    useSituationalAwareness, setUseSituationalAwareness,
    useSerendipity, setUseSerendipity
  } = useAppStore();

  if (!isOpen) return null;
  return (
     <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
        
        <div className="relative bg-white dark:bg-gray-900 w-full max-w-2xl max-h-[90vh] border border-gray-200 dark:border-gray-800 shadow-2xl flex flex-col animate-fodlan-modal overflow-hidden md:rounded-sm">
           
           {/* Fixed Header */}
           <div className="h-14 px-6 border-b border-gray-100 dark:border-gray-800 flex justify-between items-center bg-white dark:bg-gray-900 shrink-0 z-20">
              <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-gray-500">OPERATIONAL POLICY</h3>
              <IconButton onClick={onClose} title="닫기">
                 <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                 </svg>
              </IconButton>
           </div>
           
           {/* Scrollable Content Area */}
           <div className="flex-1 overflow-y-auto custom-scrollbar p-6 md:p-10">
              <div className="space-y-10 mb-12">
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-x-10 gap-y-8">
                   <StepSlider label="수위/묘사" value={storyParams.sensuality} onChange={v => setStoryParams(prev => ({...prev, sensuality: v}))} labels={['순애/정석', '열정/적극', '자극/페티시', '하드코어', '심연/타락']} />
                   <StepSlider label="전개 속도" value={storyParams.speed} onChange={v => setStoryParams(prev => ({...prev, speed: v}))} labels={['탐미/초정밀', '느림/감정', '보통', '빠름/액션', '요약/생략']} />
                 </div>
              </div>

              {/* [PR #Narrative-2.1] Modular Control Section */}
              <div className="mb-12">
                  <div className="flex items-center gap-3 mb-6">
                      <h4 className="text-[11px] font-bold text-gray-400 uppercase tracking-[0.2em]">Tactical Protocols</h4>
                      <div className="h-px flex-1 bg-gray-100 dark:bg-gray-800/50" />
                      <span className="bg-blue-600 text-white text-[8px] px-1.5 py-0.5 rounded-full font-bold animate-pulse">2.0 CORE</span>
                  </div>
                  
                  <div className="grid grid-cols-1 gap-3">
                      <ProtocolCard 
                        title="기저 침윤 (Atmosphere Infiltration)"
                        description="캐릭터의 위치를 기반으로 견문록의 장소/국가 정보를 소환하여 서사의 공기를 결정합니다."
                        isActive={useAtmosphereInfiltration}
                        onToggle={() => setUseAtmosphereInfiltration(!useAtmosphereInfiltration)}
                      />
                      <ProtocolCard 
                        title="상황 인지 (Situational Awareness)"
                        description="입력된 상황(전투, 다과회 등)을 분석하여 가장 연관성이 높은 과거의 기억을 정밀하게 소환합니다."
                        isActive={useSituationalAwareness}
                        onToggle={() => setUseSituationalAwareness(!useSituationalAwareness)}
                      />
                      <ProtocolCard 
                        title="세렌디피티 (Serendipity Algorithm)"
                        description="연대기에 기록된 복선이나 미스터리를 무작위로 주입하여 AI가 의외의 전개를 펼치도록 유도합니다."
                        isActive={useSerendipity}
                        onToggle={() => setUseSerendipity(!useSerendipity)}
                      />
                  </div>
              </div>

              <div className="mb-10">
                  <div className="flex justify-between items-end mb-3">
                     <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">추가 지침</label>
                     <span className="text-[9px] text-gray-400 font-mono">{customPrompt.length} chars</span>
                  </div>
                  <textarea 
                     value={customPrompt} 
                     onChange={e => setCustomPrompt(e.target.value)} 
                     placeholder="예: 문체를 더 고풍스럽게, 3인칭 관찰자 시점 유지, 특정 단어 사용 금지 등... 서사의 일관성을 위한 절대적인 규칙을 입력하십시오." 
                     className="w-full h-48 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-4 text-sm leading-relaxed focus:outline-none focus:border-blue-500 resize-none custom-scrollbar transition-colors dark:text-gray-200 rounded-sm font-sans" 
                  />
                  <p className="mt-3 text-[10px] text-gray-400 leading-relaxed italic opacity-70">
                     * 이 지침은 AI의 모든 대화 생성 시 최우선적으로 반영됩니다. 구체적일수록 서사가 정교해집니다.
                  </p>
              </div>
           </div>
        </div>
     </div>
  );
};
