
import React, { useState, useEffect, useMemo } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { ChronicleSidebar } from '../chronicle/ChronicleSidebar';
import { ChronicleDetail } from '../chronicle/ChronicleDetail';
import { ChronicleEditor } from '../chronicle/ChronicleEditor';

interface ChronicleModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const ChronicleModal: React.FC<ChronicleModalProps> = ({ isOpen, onClose }) => {
  const { 
      chronicles, handlePartialRefreshChronicle, handleDeleteChronicle, handleUpdateChronicle, handleToggleReference,
      viewingChronicleId, setViewingChronicleId, setIsChronicleModalOpen,
      isChronicleProcessing, processingField, setJumpToMessageId
  } = useAppStore();

  const [isEditMode, setIsEditMode] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  
  const handleJumpToChat = (messageId: string | undefined) => { 
      if (messageId) { 
          setJumpToMessageId(messageId); 
          setIsChronicleModalOpen(false); 
      } 
  };

  // Reset internal UI state on open/close
  useEffect(() => { 
      if (isOpen) { 
          setIsEditMode(false); 
      } else {
          setSearchQuery("");
      }
  }, [isOpen]);

  const absoluteChronicles = useMemo(() => [...chronicles].sort((a, b) => a.timestamp - b.timestamp), [chronicles]);
  const activeEntry = chronicles.find(c => c.id === viewingChronicleId);
  const activeIndex = activeEntry ? absoluteChronicles.findIndex(c => c.id === activeEntry.id) : -1;
  const prevEntry = activeIndex > 0 ? absoluteChronicles[activeIndex - 1] : null;
  const nextEntry = activeIndex !== -1 && activeIndex < absoluteChronicles.length - 1 ? absoluteChronicles[activeIndex + 1] : null;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-0 md:p-4 font-sans text-gray-900 dark:text-gray-100">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white dark:bg-[#121214] w-full md:max-w-6xl h-full md:h-[90vh] border-0 md:border border-gray-200 dark:border-gray-800 shadow-2xl flex flex-col md:flex-row animate-in zoom-in duration-300 overflow-hidden md:rounded-sm">
        
        <ChronicleSidebar 
            chronicles={chronicles}
            activeEntryId={viewingChronicleId}
            isEditMode={isEditMode}
            onSelectEntry={setViewingChronicleId}
            onClose={onClose}
            className={activeEntry ? 'hidden md:flex' : 'flex'}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
        />

        <div className={`flex-1 flex flex-col h-full bg-white dark:bg-[#121214] relative overflow-hidden ${!activeEntry ? 'hidden md:flex' : 'flex'}`}>
            {activeEntry ? (
                isEditMode ? (
                    <ChronicleEditor 
                        initialData={activeEntry}
                        onSave={(data) => {
                            handleUpdateChronicle(data);
                            setIsEditMode(false);
                        }}
                        onCancel={() => setIsEditMode(false)}
                        onDelete={(id) => {
                            handleDeleteChronicle(id);
                            setIsEditMode(false);
                        }}
                        isProcessing={isChronicleProcessing}
                        onClose={onClose}
                    />
                ) : (
                    <ChronicleDetail 
                        entry={activeEntry}
                        prevEntry={prevEntry}
                        nextEntry={nextEntry}
                        searchQuery={searchQuery} 
                        isProcessing={isChronicleProcessing}
                        processingField={processingField}
                        onRefresh={handlePartialRefreshChronicle}
                        onNavigate={setViewingChronicleId}
                        onJump={handleJumpToChat}
                        onToggleRef={handleToggleReference}
                        onEdit={setIsEditMode}
                        onDelete={handleDeleteChronicle}
                        onClose={onClose}
                    />
                )
            ) : (
                <div className="h-full flex flex-col items-center justify-center text-center opacity-40 font-sans p-10">
                    <div className="text-5xl grayscale mb-6">📜</div>
                    <p className="text-sm font-bold text-gray-500 uppercase tracking-widest">열람할 연대기를 선택하십시오</p>
                    <p className="text-xs text-gray-400 mt-2">좌측 목록에서 연대기를 선택하여<br/>상세 기록을 확인하거나 편집할 수 있습니다.</p>
                </div>
            )}
        </div>
      </div>
    </div>
  );
};

export default ChronicleModal;
