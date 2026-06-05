import React, { useState } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { Message } from '../../types/index';
import { IconButton } from '../ui/IconButton';

interface GalleryModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const GalleryModal: React.FC<GalleryModalProps> = ({ isOpen, onClose }) => {
  const { messages, handleDeleteImageOnly } = useAppStore();
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  if (!isOpen) return null;

  // Filter messages that have images
  const safeMessages = Array.isArray(messages) ? messages : [];
  const imageMessages = safeMessages.filter(m => m.image).reverse(); 

  const getContextDate = (currentMsg: Message, allMessages: Message[]): string | null => {
      const idx = allMessages.findIndex(m => m.id === currentMsg.id);
      if (idx === -1) return null;
      // Look FORWARD first
      for (let i = idx + 1; i < allMessages.length; i++) {
          const msg = allMessages[i];
          if (msg.role === 'user') continue;
          if (msg && msg.role === 'model' && typeof msg.content === 'string') {
              const match = msg.content.match(/<sub[^>]*>(.*?)<\/sub>/i);
              if (match && match[1]) return match[1].trim(); 
              break;
          }
      }
      // Look BACKWARD fallback
      for (let i = idx - 1; i >= 0; i--) {
          const msg = allMessages[i];
          if (msg && msg.role === 'model' && typeof msg.content === 'string') {
              const match = msg.content.match(/<sub[^>]*>(.*?)<\/sub>/i);
              if (match && match[1]) return match[1].trim(); 
          }
      }
      return null;
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-0 md:p-4">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white dark:bg-gray-900 w-full md:max-w-5xl h-full md:h-[85vh] border-0 md:border border-gray-800 shadow-2xl flex flex-col animate-in zoom-in duration-300">
        <div className="h-14 flex justify-between items-center px-4 border-b border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 shrink-0 z-10">
            <h3 className="text-[10px] font-bold uppercase tracking-[0.3em] text-gray-500">MEMORY FRAGMENTS</h3>
            <IconButton onClick={onClose} title="닫기">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                </svg>
            </IconButton>
        </div>
        <div className="flex-1 overflow-y-auto p-4 md:p-6 bg-gray-50 dark:bg-gray-950 custom-scrollbar">
           {imageMessages.length === 0 ? (
               <div className="h-full flex flex-col items-center justify-center text-center opacity-50 space-y-4"><div className="w-16 h-16 rounded-full bg-gray-200 dark:bg-gray-800 flex items-center justify-center text-3xl grayscale">🖼️</div><div><p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">기록된 조각 없음</p><p className="text-[10px] text-gray-400 leading-relaxed">대화 속에 이미지를 첨부하면<br/>이곳에 추억으로 남겨집니다.</p></div></div>
           ) : (
               <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                   {imageMessages.map((msg) => {
                       const contextDate = getContextDate(msg, safeMessages);
                       return (
                           <div key={msg.id} className="group relative aspect-square rounded-lg overflow-hidden bg-gray-200 dark:bg-gray-800 shadow-md hover:shadow-xl transition-all border border-gray-200 dark:border-gray-700">
                               <img src={msg.image} alt="Memory" className="w-full h-full object-cover cursor-zoom-in transition-transform duration-500 group-hover:scale-110" onClick={() => setSelectedImage(msg.image || null)} />
                               <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-3 translate-y-full group-hover:translate-y-0 transition-transform duration-300 pointer-events-none">
                                   {contextDate && <p className="text-[9px] text-gray-300 font-mono mb-0.5 opacity-80 truncate">{contextDate}</p>}
                                   <p className="text-[10px] text-white font-bold truncate">{msg.content || "(내용 없음)"}</p>
                               </div>
                               <button onClick={(e) => { e.stopPropagation(); if(confirm("이 '기억의 조각'을 태워 없애겠습니까?\n(이미지만 삭제되며, 대화 내용은 유지됩니다.)")) handleDeleteImageOnly(msg.id); }} className="absolute top-2 right-2 bg-red-500/80 hover:bg-red-600 text-white p-1.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-lg backdrop-blur-sm z-10" title="이미지만 삭제">
                                   <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-3.5 h-3.5"><path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" /></svg>
                               </button>
                           </div>
                       );
                   })}
               </div>
           )}
        </div>
      </div>
      {selectedImage && (
          <div className="fixed inset-0 z-[70] bg-black/95 flex items-center justify-center p-4 animate-in fade-in duration-200" onClick={() => setSelectedImage(null)}>
              <img src={selectedImage} className="max-w-full max-h-full object-contain shadow-2xl rounded-sm" />
              <button className="absolute top-6 right-6 text-white/50 hover:text-white p-2">
                 <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-8 h-8">
                   <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                 </svg>
              </button>
          </div>
      )}
    </div>
  );
};