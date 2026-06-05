
import React from 'react';
import { SectionHeader } from '../ui/SectionHeader';
import { IconButton } from '../ui/IconButton';
import { useUnitManager } from '../../hooks/useUnitManager';
import { UnitDossier } from '../unit/UnitDossier';
import { UnitList } from '../unit/UnitList';
import { UnitEditor } from '../unit/UnitEditor';

interface UnitModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const UnitModal: React.FC<UnitModalProps> = ({ isOpen, onClose }) => {
  const {
      characters, editingChar, isEditMode, aliasesInput,
      fileInputRef, showDatepicker, setShowDatepicker,
      handleImageUpload, handleRemoveImage, handleCancelEdit, handleCreateNew, handleSelectChar,
      displayQuote, isAutoQuote,
      handleSaveCharacter, handleDeleteCharacter, handleToggleCharacterActive, 
      handleUpdateCharacter, handleMoveCharacter, handleReorderCharacters, setAnalyzingCharId,
      setEditingChar, setIsEditMode, setAliasesInput
  } = useUnitManager(isOpen);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 font-sans">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm transition-opacity" onClick={onClose} />
      
      <div className="relative bg-white dark:bg-[#121214] w-full max-w-6xl h-[90vh] border border-gray-200 dark:border-gray-800 shadow-2xl flex flex-col md:flex-row animate-in zoom-in duration-300 overflow-hidden rounded-sm ring-1 ring-white/10">
        
        {/* [LEFT SIDEBAR] - Unit List */}
        <div className={`shrink-0 h-full ${editingChar ? 'hidden md:block' : 'block w-full md:w-auto'}`}>
          <UnitList 
            characters={characters}
            editingCharId={editingChar?.id}
            onSelectChar={handleSelectChar}
            onCreateNew={handleCreateNew}
            onMoveChar={handleMoveCharacter}
            onReorder={handleReorderCharacters}
            onToggleActive={handleToggleCharacterActive}
          />
        </div>

        {/* [MAIN CONTENT] - Profile View or Editor */}
        <div className={`flex-1 h-full bg-white dark:bg-[#121214] relative flex flex-col overflow-hidden ${!editingChar ? 'hidden md:flex' : 'flex'}`}>
            {editingChar ? (
                <>
                    <SectionHeader
                        title={isEditMode ? 'EDITING DOSSIER' : 'PERSONNEL FILE'}
                        onClose={onClose}
                        leftContent={
                            <div className="md:hidden">
                                <IconButton onClick={() => setEditingChar(null)}>
                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" /></svg>
                                </IconButton>
                            </div>
                        }
                        rightContent={
                            <>
                                {editingChar.id && !isEditMode && (
                                    <IconButton variant="primary" onClick={() => setAnalyzingCharId(editingChar.id)} title="상세 분석 보고서 열람">
                                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                                            <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
                                        </svg>
                                    </IconButton>
                                )}
                                {!isEditMode && (
                                    <IconButton onClick={() => setIsEditMode(true)} title="Edit">
                                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                        </svg>
                                    </IconButton>
                                )}
                            </>
                        }
                    />

                    <div className="flex-1 overflow-y-auto custom-scrollbar">
                        {isEditMode ? (
                            <UnitEditor 
                              character={editingChar}
                              aliasesInput={aliasesInput}
                              showDatepicker={showDatepicker}
                              fileInputRef={fileInputRef}
                              onUpdateField={(f, v) => setEditingChar({...editingChar, [f]: v})}
                              onUpdateAliases={setAliasesInput}
                              onToggleDatepicker={setShowDatepicker}
                              onImageUpload={handleImageUpload}
                              onRemoveImage={handleRemoveImage}
                              onSave={handleSaveCharacter}
                              onCancel={handleCancelEdit}
                              onDelete={handleDeleteCharacter}
                              allCharacters={characters}
                            />
                        ) : (
                            <UnitDossier character={editingChar} displayQuote={displayQuote} isAutoQuote={isAutoQuote} />
                        )}
                    </div>
                </>
            ) : (
                <div className="h-full flex flex-col items-center justify-center text-center opacity-40 p-10 font-sans">
                    <div className="text-5xl grayscale mb-6">♟️</div>
                    <p className="text-sm font-bold text-gray-500 uppercase tracking-widest">열람할 유닛을 선택하십시오</p>
                    <p className="text-xs text-gray-400 mt-2">좌측 명부에서 유닛을 선택하여 상세 정보를 확인하거나 편집할 수 있습니다.</p>
                </div>
            )}
        </div>
      </div>
    </div>
  );
};

export default UnitModal;
