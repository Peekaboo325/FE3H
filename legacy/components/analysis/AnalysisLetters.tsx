
import React, { useState, useEffect } from 'react';
import { Letter, CharacterProfile } from '../../types/index';
import { DeleteButton } from '../ui/DeleteButton';
import { IconButton } from '../ui/IconButton';
import { MarkdownContent } from '../SharedComponents';

interface AnalysisLettersProps {
  character: CharacterProfile;
  letters: Letter[];
  allCharacters: CharacterProfile[];
  isLoading: boolean;
  onMarkAsRead: (id: string) => void;
  onUpdate: (letter: Letter) => void;
  onDelete: (id: string) => void;
}

export const AnalysisLetters: React.FC<AnalysisLettersProps> = ({
  character, letters, allCharacters, isLoading, onMarkAsRead, onUpdate, onDelete
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'received' | 'sent' | 'archive'>('received');
  const [selectedLetterId, setSelectedLetterId] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({ title: '', content: '', signature: '' });

  const selectedLetter = letters.find(l => l.id === selectedLetterId);

  useEffect(() => {
    if (selectedLetter) {
      setEditForm({
        title: selectedLetter.title,
        content: selectedLetter.content,
        signature: selectedLetter.signature || ''
      });
    }
  }, [selectedLetter?.id]);

  // Filter letters based on sub-tab
  const filteredLetters = letters.filter(l => {
    // 자가 발신 서신은 UI에서 제외 (데이터 오염 방지용 안전장치)
    if (l.senderId === l.receiverId) return false;

    if (activeSubTab === 'received') return l.receiverId === character.id && l.status === 'sent';
    if (activeSubTab === 'sent') return l.senderId === character.id && l.status === 'sent';
    if (activeSubTab === 'archive') return l.senderId === character.id && l.status === 'draft';
    return false;
  }).sort((a, b) => b.timestamp - a.timestamp);

  const handleLetterClick = (id: string) => {
    setSelectedLetterId(id);
    onMarkAsRead(id);
    setIsEditing(false);
  };

  const handleSaveEdit = () => {
    if (!selectedLetter) return;
    onUpdate({
      ...selectedLetter,
      title: editForm.title,
      content: editForm.content,
      signature: editForm.signature
    });
    setIsEditing(false);
  };

  const getDisplayName = (id: string, letter?: Letter, onlyFirstName: boolean = false, isSender: boolean = true) => {
    let name = '';
    // 1. 모브 NPC인 경우
    if (id.startsWith('mob-') && letter) {
      if (isSender) {
        // 발신자인 경우 서명(Signature)을 활용하여 익명성 유지 및 시스템 ID 노출 방지
        const sig = letter.signature || '';
        // "당신의", "친애하는" 등의 수식어를 제거하고 직함만 남김
        name = sig.replace(/^(당신의|친애하는|나의|존경하는|사랑하는|그대의)\s+/, '').trim() || '익명의 발신인';
      } else {
        // 수신자인 경우 (서명을 수신인 이름으로 쓰지 않도록 방어)
        // [Option 1] AI가 추출한 수신인 이름이 있다면 사용
        name = letter.recipient_name || '익명의 수신인';
      }
    } else {
      // 2. 일반 캐릭터 조회
      const char = allCharacters.find(c => c.id === id);
      if (char) {
        name = char.name;
      } else {
        // 인연 리스트에 있는 조연 캐릭터 확인
        for (const p of allCharacters) {
            const minor = p.bonds?.find(b => b.id === id);
            if (minor) {
              name = minor.name;
              break;
            }
        }
      }
    }

    if (!name) return id;
    // 리스트 화면 요구사항: 네임드 캐릭터인 경우에만 퍼스트네임만 출력 (모브 NPC 직함은 보존)
    const isNamedCharacter = !id.startsWith('mob-');
    return (onlyFirstName && isNamedCharacter) ? name.split(' ')[0] : name;
  };

  if (selectedLetter) {
    return (
      <div className="max-w-3xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-300">
        <div className="flex justify-between items-center mb-6">
          <button 
            onClick={() => { setSelectedLetterId(null); setIsEditing(false); }}
            className="flex items-center gap-2 text-[10px] font-bold text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 uppercase tracking-widest transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-3 h-3">
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
            </svg>
            목록으로 돌아가기
          </button>

          <div className="flex items-center gap-2">
            {!isEditing ? (
              <IconButton 
                onClick={() => setIsEditing(true)}
                title="서신 수정"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" /></svg>
              </IconButton>
            ) : (
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => setIsEditing(false)}
                  className="px-3 py-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-[10px] font-bold uppercase tracking-widest transition-colors"
                >
                  취소
                </button>
                <button 
                  onClick={handleSaveEdit}
                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-[10px] font-bold uppercase tracking-widest rounded transition-colors shadow-sm"
                >
                  저장
                </button>
              </div>
            )}
            <DeleteButton 
              onConfirm={() => { onDelete(selectedLetter.id); setSelectedLetterId(null); }}
              confirmTitle="이 서신을 영구히 소각하시겠습니까?"
            />
          </div>
        </div>

        <div className="bg-white dark:bg-[#18181b] border border-gray-100 dark:border-gray-800 rounded-lg shadow-sm overflow-hidden">
          <div className="p-6 md:p-8 border-b border-gray-50 dark:border-gray-800">
            <div className="space-y-3">
              {isEditing ? (
                <input 
                  type="text"
                  value={editForm.title}
                  onChange={(e) => setEditForm(prev => ({ ...prev, title: e.target.value }))}
                  className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded px-3 py-2 text-base font-normal text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                  placeholder="서신 제목"
                />
              ) : (
                <h2 className="text-base font-normal text-gray-900 dark:text-gray-100 tracking-tight">{selectedLetter.title}</h2>
              )}
              
              <div className="flex items-center gap-2 text-[10px] text-gray-400 font-bold uppercase tracking-widest">
                {selectedLetter.receiverId === character.id ? (
                  <>
                    <span>발신:</span>
                    <span className="text-gray-600 dark:text-gray-300">{getDisplayName(selectedLetter.senderId, selectedLetter, false, true)}</span>
                  </>
                ) : (
                  <>
                    <span>수신:</span>
                    <span className="text-gray-600 dark:text-gray-300">{getDisplayName(selectedLetter.receiverId, selectedLetter, false, false)}</span>
                  </>
                )}
              </div>
            </div>
          </div>
          
          <div className="p-8 md:p-12 min-h-[300px] flex flex-col">
            {isEditing ? (
              <textarea 
                value={editForm.content}
                onChange={(e) => setEditForm(prev => ({ ...prev, content: e.target.value }))}
                className="flex-1 w-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded p-4 text-sm text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/50 min-h-[400px] font-sans leading-relaxed"
                placeholder="서신 내용을 입력하세요..."
              />
            ) : (
              <div className="prose dark:prose-invert max-w-none">
                <MarkdownContent content={selectedLetter.content} variant="compact" />
              </div>
            )}

            <div className="mt-12 pt-8 border-t border-gray-50 dark:border-gray-800 text-right">
              <div className="inline-block text-left max-w-[90%] md:max-w-[70%]">
                {isEditing ? (
                  <div className="space-y-1">
                    <label className="text-[8px] font-bold text-gray-400 uppercase tracking-widest">서명</label>
                    <input 
                      type="text"
                      value={editForm.signature}
                      onChange={(e) => setEditForm(prev => ({ ...prev, signature: e.target.value }))}
                      className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded px-3 py-1.5 text-sm font-normal text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                      placeholder="서명"
                    />
                  </div>
                ) : (
                  <p className={`${(selectedLetter.signature?.length ?? 0) > 20 ? 'text-xs' : 'text-sm'} font-bold text-gray-800 dark:text-gray-200 break-keep leading-relaxed`}>
                    {selectedLetter.signature}
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-10">
      {/* Sub-tabs */}
      <div className="flex border-b border-gray-100 dark:border-gray-800 mb-8">
        {[
          { id: 'received', label: '받은 서신' },
          { id: 'sent', label: '보낸 서신' },
          { id: 'archive', label: '보관함' }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveSubTab(tab.id as any)}
            className={`flex-1 py-2 text-[10px] font-bold uppercase tracking-widest transition-colors relative text-center ${activeSubTab === tab.id ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400' : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'}`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Letters List */}
      <div className="space-y-2">
        {/* Loading Skeleton for New Letter (Prepend to list) */}
        {isLoading && (
          <div className="bg-white/50 dark:bg-[#18181b]/50 p-4 md:px-6 border border-dashed border-blue-200 dark:border-blue-800 rounded-lg flex items-center justify-between shadow-sm animate-pulse">
            <div className="flex items-center gap-4 min-w-0">
              <div className="w-24 h-4 bg-gray-200 dark:bg-gray-800 rounded" />
              <div className="w-48 h-4 bg-gray-100 dark:bg-gray-900 rounded" />
            </div>
            <div className="w-16 h-3 bg-gray-100 dark:bg-gray-900 rounded" />
          </div>
        )}

        {filteredLetters.length === 0 && !isLoading ? (
          <div className="text-center py-20 text-gray-400 text-xs font-sans tracking-wide bg-gray-50/50 dark:bg-gray-800/30 rounded-lg border border-dashed border-gray-200 dark:border-gray-800">
            기록된 서신이 없습니다.
          </div>
        ) : (
          filteredLetters.map(letter => (
            <div 
              key={letter.id}
              onClick={() => handleLetterClick(letter.id)}
              className="group bg-white dark:bg-[#18181b] p-4 md:px-6 border border-gray-100 dark:border-gray-800 hover:border-blue-200 dark:hover:border-blue-800 rounded-lg transition-all cursor-pointer flex items-center justify-between shadow-sm"
            >
              <div className="flex items-center gap-4 min-w-0">
                {letter.isSealed ? (
                  <span className="px-1.5 py-0.5 bg-blue-600 text-white text-[8px] font-bold rounded-sm uppercase tracking-tighter shrink-0 animate-pulse">
                    봉인
                  </span>
                ) : (
                  letter.senderId === character.id ? (
                    <span className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 text-[8px] font-bold rounded-sm uppercase tracking-tighter shrink-0 border border-gray-200 dark:border-gray-700">
                      발신
                    </span>
                  ) : (
                    <span className="px-1.5 py-0.5 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 text-[8px] font-bold rounded-sm uppercase tracking-tighter shrink-0 border border-blue-100 dark:border-blue-800">
                      수신
                    </span>
                  )
                )}
                <h4 className="text-sm font-bold text-gray-800 dark:text-gray-200 truncate group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                  {letter.title}
                </h4>
              </div>
              <div className="text-[10px] text-gray-400 font-bold uppercase tracking-widest shrink-0 ml-4">
                {letter.receiverId === character.id ? getDisplayName(letter.senderId, letter, true, true) : getDisplayName(letter.receiverId, letter, true, false)}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
