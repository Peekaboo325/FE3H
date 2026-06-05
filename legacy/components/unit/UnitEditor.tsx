
import React, { useState } from 'react';
import { CharacterProfile, BondRecord } from '../../types/index';
import { DeleteButton } from '../ui/DeleteButton';
import Button from '../ui/Button';
import { Input } from '../ui/Input';
import FodlanDatepicker from '../FodlanDatepicker';
import { generateId, extractFirstName } from '../../utils/textUtils';
import { recommendEnglishName, classifyBondTheme } from '../../services/geminiService';

interface UnitEditorProps {
  character: CharacterProfile;
  aliasesInput: string;
  showDatepicker: boolean;
  fileInputRef: React.RefObject<HTMLInputElement>;
  onUpdateField: <K extends keyof CharacterProfile>(field: K, value: CharacterProfile[K]) => void;
  onUpdateAliases: (value: string) => void;
  onToggleDatepicker: (show: boolean) => void;
  onImageUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onRemoveImage: (e: React.MouseEvent) => void;
  onSave: () => void;
  onCancel: () => void;
  onDelete: (id: string) => void;
  allCharacters?: CharacterProfile[];
}

const stopPropagation = (e: React.PointerEvent | React.MouseEvent | React.KeyboardEvent) => {
    e.stopPropagation();
};

export const UnitEditor: React.FC<UnitEditorProps> = ({
  character,
  aliasesInput,
  showDatepicker,
  fileInputRef,
  onUpdateField,
  onUpdateAliases,
  onToggleDatepicker,
  onImageUpload,
  onRemoveImage,
  onSave,
  onCancel,
  onDelete,
  allCharacters = []
}) => {
  const [isBondsExpanded, setIsBondsExpanded] = useState(false);
  const [mainEngPlaceholder, setMainEngPlaceholder] = useState("");
  const [bondPlaceholders, setBondPlaceholders] = useState<Record<string, string>>({});
  const [isMatching, setIsMatching] = useState(false);
  const [isClassifying, setIsClassifying] = useState<Record<string, boolean>>({});

  const inputBaseClass = "w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-sm px-3 h-10 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all outline-none dark:text-gray-200 placeholder-gray-300 dark:placeholder-gray-600 font-sans";
  const labelClass = "text-[10px] font-bold text-gray-400 uppercase block mb-1.5 tracking-wider";

  const handleAddBond = (e: React.MouseEvent) => {
      e.stopPropagation();
      const newBond: BondRecord = {
          id: generateId(),
          name: '',
          english_name: '',
          category: '',
          description: '',
          order: (character.bonds?.length || 0),
          life_status: 'alive'
      };
      onUpdateField('bonds', [...(character.bonds || []), newBond]);
      setIsBondsExpanded(true);
  };

  const handleUpdateBond = <K extends keyof BondRecord>(id: string, field: K, val: BondRecord[K]) => {
      const nextBonds = (character.bonds || []).map(b => b.id === id ? { ...b, [field]: val } : b);
      onUpdateField('bonds', nextBonds);
  };

  const handleRemoveBond = (id: string) => {
      onUpdateField('bonds', (character.bonds || []).filter(b => b.id !== id));
  };

  // [Trigger B] 단일 인연 테마 실시간 분석
  const handleAutoClassifyBond = async (id: string, category: string, desc: string) => {
      if (!desc.trim() || isClassifying[id]) return;
      setIsClassifying(prev => ({ ...prev, [id]: true }));
      try {
          const theme = await classifyBondTheme(category, desc);
          handleUpdateBond(id, 'theme', theme);
      } catch (e) {
          console.error("Bond classification failed", e);
      } finally {
          setIsClassifying(prev => ({ ...prev, [id]: false }));
      }
  };

  const handleAutoFillEnglishName = async (type: 'main' | 'bond', idOrName: string, koreanName: string) => {
      if (!koreanName.trim() || isMatching) return;
      setIsMatching(true);
      let foundName = "";
      const cleanInput = koreanName.trim();
      const matched = allCharacters.find(c => c.name.trim() === cleanInput || extractFirstName(c.name) === cleanInput);
      
      if (matched && matched.english_name) {
          foundName = matched.english_name;
      } else {
          foundName = await recommendEnglishName(koreanName);
      }

      if (foundName) {
          if (type === 'main') {
              onUpdateField('english_name', foundName);
              setMainEngPlaceholder(foundName);
          } else {
              handleUpdateBond(idOrName, 'english_name', foundName);
              setBondPlaceholders(prev => ({ ...prev, [idOrName]: foundName }));
          }
      }
      setIsMatching(false);
  };

  const bondCount = character.bonds?.length || 0;

  return (
    <div className="p-6 md:p-10 space-y-10 max-w-3xl mx-auto w-full animate-in fade-in duration-300 pb-24">
      <div className="flex flex-col md:flex-row gap-6 items-center md:items-start">
        <div className="w-48 h-48 md:w-32 md:h-32 rounded-lg bg-gray-100 dark:bg-gray-800 border-2 border-dashed border-gray-300 dark:border-gray-700 flex items-center justify-center cursor-pointer hover:border-blue-500 overflow-hidden relative group shrink-0 transition-all" onClick={() => fileInputRef.current?.click()} onPointerDown={stopPropagation}>
          {character.thumbnail ? (
            <><img src={character.thumbnail} className="w-full h-full object-cover" alt="Upload preview" /><div className="absolute top-1 right-1 p-1 bg-red-500/80 hover:bg-red-600 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity z-10" onClick={onRemoveImage} onPointerDown={stopPropagation}><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-3.5 h-3.5"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" /></svg></div></>
          ) : <span className="text-2xl text-gray-400">+</span>}
          <div className={`absolute inset-0 bg-black/40 flex items-center justify-center ${character.thumbnail ? 'opacity-0 group-hover:opacity-100' : 'opacity-0'} transition-opacity pointer-events-none`}><span className="text-[10px] text-white font-bold uppercase">사진 변경</span></div>
        </div>
        <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={onImageUpload} />
        
        <div className="flex-1 w-full space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input label="국문명" value={character.name || ''} onChange={e => onUpdateField('name', e.target.value)} onPointerDown={stopPropagation} placeholder="필수 항목" />
            <div>
              <div className="flex justify-between items-end mb-1"><label className={labelClass}>영문명</label><button onClick={() => handleAutoFillEnglishName('main', '', character.name || '')} onPointerDown={stopPropagation} className={`text-gray-400 hover:text-blue-500 transition-colors p-0.5 ${isMatching ? 'opacity-50' : ''}`} title="명부 대조 및 분석" disabled={isMatching}><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-3.5 h-3.5"><path strokeLinecap="round" strokeLinejoin="round" d="M15.666 3.888A2.25 2.25 0 0 0 13.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 0 1-.75.75H9a.75.75 0 0 1-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 0 1-2.25 2.25H6.75A2.25 2.25 0 0 1 4.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 0 1 1.927-.184" /></svg></button></div>
              <Input value={character.english_name || ''} onChange={e => onUpdateField('english_name', e.target.value)} onPointerDown={stopPropagation} placeholder={mainEngPlaceholder} />
            </div>
          </div>
          {/* [PO's SPEC] '서사 참여' 삭제 및 '이명' 확장, '상태' 축소 레이아웃 적용 */}
          <div className="grid grid-cols-1 md:grid-cols-[1fr_84px] gap-4">
            <Input label="이명" value={aliasesInput} onChange={e => onUpdateAliases(e.target.value)} onPointerDown={stopPropagation} placeholder="칭호, 별명" />
            <div className="w-full md:w-[84px]">
                <label className={labelClass}>상태</label>
                <select value={character.life_status || 'alive'} onChange={e => onUpdateField('life_status', e.target.value as CharacterProfile['life_status'])} onPointerDown={stopPropagation} className={`${inputBaseClass} px-1 text-center`}>
                    <option value="alive">생존</option>
                    <option value="deceased">사망</option>
                    <option value="unknown">불명</option>
                </select>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Input label="활동 거점" value={character.current_location || ''} onChange={e => onUpdateField('current_location', e.target.value)} onPointerDown={stopPropagation} placeholder="가르그 마크 대수도원" />
        <div>
          <div className="flex justify-between items-end mb-1"><label className={labelClass}>대표 대사</label>{character.analysis?.generated_quote && (<button onClick={() => onUpdateField('signature_quote', character.analysis?.generated_quote)} onPointerDown={stopPropagation} className="text-gray-400 hover:text-blue-500 transition-colors p-0.5" title={`AI 추천 대사 적용: ${character.analysis.generated_quote}`}><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-3.5 h-3.5"><path strokeLinecap="round" strokeLinejoin="round" d="M15.666 3.888A2.25 2.25 0 0 0 13.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 0 1-.75.75H9a.75.75 0 0 1-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 0 1-2.25 2.25H6.75A2.25 2.25 0 0 1 4.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 0 1 1.927-.184" /></svg></button>)}</div>
          <Input value={character.signature_quote || ''} onChange={e => onUpdateField('signature_quote', e.target.value)} onPointerDown={stopPropagation} placeholder={character.analysis?.generated_quote || "인물의 가치관을 관통하는 문장"} />
        </div>
      </div>

      <div><label className={labelClass}>인물 기록</label><textarea value={character.description || ''} onChange={e => onUpdateField('description', e.target.value)} onPointerDown={stopPropagation} className="w-full h-48 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 focus:border-blue-500 p-4 text-sm leading-relaxed resize-none rounded-none custom-scrollbar dark:text-gray-200 transition-all outline-none font-sans" /></div>

      <div className="pt-4 border-t border-gray-100 dark:border-gray-800">
        <button onClick={() => setIsBondsExpanded(!isBondsExpanded)} onPointerDown={stopPropagation} className="w-full flex items-center justify-between group py-2">
          <div className="flex items-center gap-3"><label className={`${labelClass} mb-0 cursor-pointer group-hover:text-gray-600 dark:group-hover:text-gray-200 transition-colors`}>인연 기록 {bondCount > 0 && <span className="ml-1 text-blue-500 opacity-80">({bondCount})</span>}</label><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className={`w-3 h-3 text-gray-300 transition-transform duration-300 ${isBondsExpanded ? 'rotate-180' : ''}`}><path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" /></svg></div>
          <span onClick={handleAddBond} className="text-[10px] text-blue-500 font-bold hover:underline cursor-pointer">+ 기록 추가</span>
        </button>

        {isBondsExpanded && (
          <div className="space-y-10 mt-6 animate-in slide-in-from-top-2 fade-in duration-300">
            {(character.bonds || []).map((bond) => (
              <div key={bond.id} className="relative bg-gray-50/50 dark:bg-black/20 border border-gray-200 dark:border-gray-700 p-6 rounded-none space-y-6">
                <div className="flex justify-between items-center border-b border-gray-100 dark:border-gray-800 pb-3">
                   <div className="flex items-center gap-3">
                      <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Bond Record</span>
                      <div className="h-4 w-px bg-gray-200 dark:bg-gray-700" />
                      <select 
                        value={bond.life_status || 'alive'} 
                        onChange={e => handleUpdateBond(bond.id, 'life_status', e.target.value as BondRecord['life_status'])} 
                        onPointerDown={stopPropagation} 
                        className="bg-transparent text-[9px] font-bold uppercase tracking-tighter text-blue-500 outline-none cursor-pointer"
                      >
                        <option value="alive">생존</option>
                        <option value="deceased">사망</option>
                        <option value="unknown">실종</option>
                      </select>
                   </div>
                   <DeleteButton onConfirm={() => handleRemoveBond(bond.id)} title="기록 삭제" confirmTitle="정말 삭제하시겠습니까?" className="hover:bg-white dark:hover:bg-gray-800" />
                </div>
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-[1fr_1fr_80px] gap-4">
                    <Input label="국문명" value={bond.name} onChange={e => handleUpdateBond(bond.id, 'name', e.target.value)} onPointerDown={stopPropagation} placeholder="필수 항목" />
                    <div>
                       <div className="flex justify-between items-end mb-1"><label className="text-[9px] font-bold text-gray-400 uppercase block">영문명</label><button onClick={() => handleAutoFillEnglishName('bond', bond.id, bond.name)} onPointerDown={stopPropagation} className={`text-gray-400 hover:text-blue-500 transition-colors p-0.5 ${isMatching ? 'opacity-50' : ''}`} title="명부 대조 및 분석" disabled={isMatching}><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-3 h-3"><path strokeLinecap="round" strokeLinejoin="round" d="M15.666 3.888A2.25 2.25 0 0 0 13.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 0 1-.75.75H9a.75.75 0 0 1-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 0 1-2.25 2.25H6.75A2.25 2.25 0 0 1 4.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 0 1 1.927-.184" /></svg></button></div>
                       <Input value={bond.english_name || ''} onChange={e => handleUpdateBond(bond.id, 'english_name', e.target.value)} onPointerDown={stopPropagation} placeholder={bondPlaceholders[bond.id] || ""} />
                    </div>
                    <div><label className="text-[9px] font-bold text-gray-400 uppercase mb-1 block">관계</label><input value={bond.category} onChange={e => handleUpdateBond(bond.id, 'category', e.target.value)} onPointerDown={stopPropagation} maxLength={4} className={`${inputBaseClass} px-1 text-center`} placeholder="유형" /></div>
                  </div>
                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <label className="text-[9px] font-bold text-gray-400 uppercase block">내용</label>
                      <button onClick={() => handleAutoClassifyBond(bond.id, bond.category, bond.description)} disabled={!bond.description.trim() || isClassifying[bond.id]} className={`text-[9px] font-bold px-2 py-0.5 rounded-sm border transition-all ${isClassifying[bond.id] ? 'text-blue-500 border-blue-200 animate-pulse' : 'text-gray-400 border-gray-200 hover:text-blue-500 hover:border-blue-500'}`}>{isClassifying[bond.id] ? '분류 중' : 'AI 테마 분석'}</button>
                    </div>
                    <textarea value={bond.description} onChange={e => handleUpdateBond(bond.id, 'description', e.target.value)} onPointerDown={stopPropagation} className={`${inputBaseClass} h-24 py-3 resize-none rounded-none leading-relaxed`} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="pt-6 space-y-6">
        <div className="flex gap-4 border-t border-gray-100 dark:border-gray-800 pt-6">
            <Button variant="secondary" onClick={onCancel} onPointerDown={stopPropagation} className="flex-1">취소</Button>
            <Button variant="primary" onClick={onSave} onPointerDown={stopPropagation} className="flex-1">저장</Button>
        </div>
        
        {character.id && (
            <div className="flex justify-end pb-4">
                <DeleteButton 
                    onConfirm={() => onDelete(character.id)} 
                    title="유닛 영구 삭제" 
                    confirmTitle="정말 삭제하시겠습니까?" 
                    className="text-gray-400 hover:text-red-500" 
                />
            </div>
        )}
      </div>
    </div>
  );
};
