import { useEffect, useState } from 'react';
import { Check, X, Pencil, Copy, Trash2, Eraser, MoreHorizontal, Download } from 'lucide-react';
import { defaultStoryTitle } from './storyTitle';
import { confirmAsk } from './dialog';
import { showToast } from './toast';
import { UI } from './strings';
import { stripMarkdown } from './podraScript';
import Modal from './Modal';
import Button from './Button';
import IconButton from './IconButton';
import Spinner from './Spinner';
import GenControls, { type GenConfig } from './Settings';
import UsagePanel from './UsagePanel';

// 장 본문(조수 화들)을 한 텍스트로 — 마크다운 그대로(markdown) 또는 글만(stripMarkdown). 화 사이 빈 줄.
type Turn = { role: string; content?: string };
function 장본문텍스트(turns: Turn[], markdown: boolean): string {
  return turns
    .filter((t) => t.role === 'assistant' && t.content?.trim())
    .map((t) => (markdown ? t.content!.trim() : stripMarkdown(t.content!)))
    .join('\n\n\n');
}

type Story = { id: number; title: string; updated_at?: string };

export default function Stories({
  currentStoryId,
  onSwitch,
  onClose,
  genConfig,
  onGenChange,
}: {
  currentStoryId: number | null;
  onSwitch: (id: number, title: string) => void;
  onClose: () => void;
  genConfig: GenConfig;
  onGenChange: (c: GenConfig) => void;
}) {
  const [list, setList] = useState<Story[]>([]);
  const [loading, setLoading] = useState(true);
  const [dbReady, setDbReady] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [copyingId, setCopyingId] = useState<number | null>(null);
  const [renamingId, setRenamingId] = useState<number | null>(null); // 개칭 중인 장
  const [renameText, setRenameText] = useState('');
  const [menuId, setMenuId] = useState<number | null>(null); // ⋯ 더보기 메뉴 펼친 장
  const [tab, setTab] = useState<'records' | 'writing' | 'usage'>('records'); // 천각의 박동 탭
  const [exportStory, setExportStory] = useState<Story | null>(null); // 반출 다이얼로그 대상 장
  const [exportMd, setExportMd] = useState(true); // 반출 시 마크다운 양식 포함 여부
  const [exportBusy, setExportBusy] = useState(false);

  // 반출 — 그 장의 본문(조수 화들)을 한 번 읽어 텍스트 파일로 내린다. 본문만(프롬프트·[초안]/[연출] 제외).
  //  풀 리드지만 '전체를 받겠다'는 수동·드문 동작이라 정당(§9 이그레스 규율에 어긋나지 않음).
  async function 반출하기(s: Story, markdown: boolean) {
    if (exportBusy) return;
    setExportBusy(true);
    try {
      const r = await fetch(`/api/turns?story_id=${s.id}`);
      const d = await r.json();
      const turns: Turn[] = Array.isArray(d?.turns) ? d.turns : [];
      const text = 장본문텍스트(turns, markdown);
      if (!text.trim()) {
        showToast('반출할 본문이 없습니다.');
        return;
      }
      const 날짜 = new Date().toISOString().slice(0, 10);
      const 파일명 = `${(s.title || '운명의 장').replace(/[\\/:*?"<>|]/g, '_')}_${날짜}.txt`;
      const url = URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = 파일명;
      a.click();
      URL.revokeObjectURL(url);
      setExportStory(null);
      showToast('장을 반출하였습니다.');
    } catch {
      showToast('장을 반출하지 못했습니다.');
    } finally {
      setExportBusy(false);
    }
  }

  // 메뉴 바깥을 누르면 닫는다(여는 클릭이 바로 닫지 않게 다음 틱부터 듣는다).
  useEffect(() => {
    if (menuId == null) return;
    const close = () => setMenuId(null);
    const id = window.setTimeout(() => document.addEventListener('click', close), 0);
    return () => {
      window.clearTimeout(id);
      document.removeEventListener('click', close);
    };
  }, [menuId]);

  async function load() {
    setLoading(true);
    try {
      const r = await fetch('/api/stories');
      const d = await r.json();
      setDbReady(!!d.dbReady);
      setErr(d.error || null);
      setList(Array.isArray(d.stories) ? d.stories : []);
    } catch (e) {
      setErr((e as Error).message);
    }
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function 새이야기() {
    const r = await fetch('/api/stories', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ title: defaultStoryTitle(list.length + 1) }),
    });
    const d = await r.json();
    if (!r.ok || d.error || !d.story) {
      showToast('새 운명의 장을 펼치지 못했습니다.');
      return;
    }
    onSwitch(d.story.id, d.story.title); // 새 이야기로 전환
  }

  async function 복사(s: Story) {
    setCopyingId(s.id);
    try {
      const r = await fetch('/api/stories', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ copy_from: s.id }),
      });
      const d = await r.json();
      if (!r.ok || d.error) {
        showToast(`운명의 장을 ${UI.copy}하지 못했습니다.`);
        return;
      }
      await load();
    } finally {
      setCopyingId(null);
    }
  }

  function 개칭시작(s: Story) {
    setRenamingId(s.id);
    setRenameText(s.title);
  }

  async function 개칭저장(s: Story) {
    const t = renameText.trim();
    setRenamingId(null);
    if (!t || t === s.title) return; // 빈 이름·무변경이면 그대로 둔다
    const r = await fetch('/api/stories', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ id: s.id, title: t }),
    });
    const d = await r.json();
    if (!r.ok || d.error) {
      showToast(`운명의 장을 ${UI.rename}하지 못했습니다.`);
      return;
    }
    await load();
    if (s.id === currentStoryId && d.story) onSwitch(d.story.id, d.story.title); // 헤더 제목 갱신
  }

  // 환원 — 장은 남기고 본문(전 회차)·연대 문헌만 백지로. 인물 명부·대륙 문헌은 그대로.
  async function 환원(s: Story) {
    const yes = await confirmAsk({
      message: `「${s.title}」 이 장을 ${UI.revert}하시겠습니까?`,
      detail: `본문과 연대 문헌이 모두 비워지고 백지 장만 남습니다. 인물 명부와 대륙 문헌은 남으나, 환원된 기록은 다시 불러올 수 없습니다.`,
      confirmLabel: UI.revert,
      danger: true,
    });
    if (!yes) return;
    const r = await fetch(`/api/turns?story_id=${s.id}`, { method: 'DELETE' });
    const d = await r.json();
    if (!r.ok || d.error) {
      showToast(`운명의 장을 ${UI.revert}하지 못했습니다.`);
      return;
    }
    // 지금 펼쳐둔 장을 환원했다면 백지가 된 장을 새로 펼친다.
    if (s.id === currentStoryId) onSwitch(s.id, s.title);
  }

  async function 삭제(s: Story) {
    const yes = await confirmAsk({
      message: `「${s.title}」 이 기록을 ${UI.erase}하시겠습니까?`,
      detail: `${UI.erase}된 기록은 다시 불러올 수 없습니다.`,
      confirmLabel: UI.erase,
      danger: true,
    });
    if (!yes) return;
    const r = await fetch(`/api/stories?id=${s.id}`, { method: 'DELETE' });
    const d = await r.json();
    if (!r.ok || d.error) {
      showToast(`운명의 장을 ${UI.erase}하지 못했습니다.`);
      return;
    }
    // 목록 갱신 + 현재 이야기를 지웠으면 다른 이야기로 전환.
    const r2 = await fetch('/api/stories');
    const d2 = await r2.json();
    const fresh: Story[] = Array.isArray(d2.stories) ? d2.stories : [];
    setList(fresh);
    if (s.id === currentStoryId) {
      if (fresh.length > 0) {
        onSwitch(fresh[0].id, fresh[0].title);
      } else {
        const cr = await fetch('/api/stories', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ title: defaultStoryTitle(1) }),
        });
        const cd = await cr.json();
        if (cd.story) onSwitch(cd.story.id, cd.story.title);
      }
    }
  }

  return (
    <>
    <Modal onClose={onClose} title="천각의 박동">
      <div className="modal-tabs">
        <button
          className={'modal-tab' + (tab === 'records' ? ' active' : '')}
          onClick={() => setTab('records')}
        >
          기록 관리
        </button>
        <button
          className={'modal-tab' + (tab === 'writing' ? ' active' : '')}
          onClick={() => setTab('writing')}
        >
          집필 설정
        </button>
        <button
          className={'modal-tab' + (tab === 'usage' ? ' active' : '')}
          onClick={() => setTab('usage')}
        >
          사용 내역
        </button>
      </div>

      {tab === 'writing' && (
        <div className="tab-panel">
          <GenControls config={genConfig} onChange={onGenChange} />
        </div>
      )}
      {tab === 'usage' && (
        <div className="tab-panel">
          <UsagePanel />
        </div>
      )}
      {tab === 'records' && (
        <div className="tab-panel">
          {!dbReady && (
            <p className="warn">기록의 샘이 닿지 않아 운명의 장을 기록하거나 갈무리할 수 없습니다.</p>
          )}
          {dbReady && err && (
            <p className="warn">
              이야기 표가 아직 없는 듯합니다. 안내된 SQL을 Supabase에서 한 번 실행하십시오.
              <br />
              <span className="dim">({err})</span>
            </p>
          )}

          <div className="modal-body">
          <button className="new" onClick={새이야기}>
            ＋ 새로운 운명의 장
          </button>
          {loading ? (
            <Spinner />
          ) : list.length === 0 ? (
            <p className="list-empty">아직 펼친 장이 없습니다.</p>
          ) : (
            <ul className="char-list">
              {list.map((s) =>
                renamingId === s.id ? (
                  <li key={s.id} className={'char-row' + (s.id === currentStoryId ? ' current' : '')}>
                    <input
                      className="rename-input"
                      value={renameText}
                      autoFocus
                      onChange={(e) => setRenameText(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.nativeEvent.isComposing) return; // 한글 조합 중 무시
                        if (e.key === 'Enter') 개칭저장(s);
                        if (e.key === 'Escape') setRenamingId(null);
                      }}
                    />
                    <div className="row-actions">
                      <IconButton label={UI.save} onClick={() => 개칭저장(s)}>
                        <Check size={16} />
                      </IconButton>
                      <IconButton label={UI.cancel} onClick={() => setRenamingId(null)}>
                        <X size={16} />
                      </IconButton>
                    </div>
                  </li>
                ) : (
                  <li key={s.id} className={'char-row' + (s.id === currentStoryId ? ' current' : '')}>
                    <div className="char-meta clickable" onClick={() => onSwitch(s.id, s.title)}>
                      <div className="char-name">
                        {s.title}
                        {s.id === currentStoryId && <span className="tag">현재</span>}
                      </div>
                    </div>
                    <div className="row-actions">
                      <div className="row-menu-wrap">
                        <IconButton
                          label="더보기"
                          onClick={(e) => {
                            e.stopPropagation();
                            setMenuId(menuId === s.id ? null : s.id);
                          }}
                        >
                          <MoreHorizontal size={16} />
                        </IconButton>
                        {menuId === s.id && (
                          <div className="row-menu" onClick={(e) => e.stopPropagation()}>
                            <button
                              className="row-menu-item"
                              onClick={() => {
                                setMenuId(null);
                                개칭시작(s);
                              }}
                            >
                              <Pencil size={15} />
                              {UI.rename}
                            </button>
                            <button
                              className="row-menu-item"
                              disabled={copyingId === s.id}
                              onClick={() => {
                                setMenuId(null);
                                복사(s);
                              }}
                            >
                              <Copy size={15} />
                              {UI.copy}
                            </button>
                            <button
                              className="row-menu-item"
                              onClick={() => {
                                setMenuId(null);
                                setExportMd(true);
                                setExportStory(s);
                              }}
                            >
                              <Download size={15} />
                              {UI.export}
                            </button>
                            <button
                              className="row-menu-item danger"
                              onClick={() => {
                                setMenuId(null);
                                환원(s);
                              }}
                            >
                              <Eraser size={15} />
                              {UI.revert}
                            </button>
                            <button
                              className="row-menu-item danger"
                              onClick={() => {
                                setMenuId(null);
                                삭제(s);
                              }}
                            >
                              <Trash2 size={15} />
                              {UI.erase}
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </li>
                ),
              )}
            </ul>
          )}
          </div>
        </div>
      )}
    </Modal>

    {exportStory && (
      <Modal onClose={() => setExportStory(null)} title={`${UI.export} — 「${exportStory.title}」`}>
        <div className="modal-body">
          <p className="dim">이 장의 본문(화)을 텍스트 파일로 반출합니다. 프롬프트·[초안]/[연출]은 빼고 본문만 담깁니다.</p>
          <div className="settings-group">
            <div className="settings-label">마크다운 양식</div>
            <div className="settings-options">
              <button className={'settings-opt' + (exportMd ? ' on' : '')} onClick={() => setExportMd(true)}>
                포함
              </button>
              <button className={'settings-opt' + (!exportMd ? ' on' : '')} onClick={() => setExportMd(false)}>
                글만
              </button>
            </div>
          </div>
          <div className="dialog-actions">
            <Button variant="primary" loading={exportBusy} onClick={() => 반출하기(exportStory, exportMd)}>
              {UI.export}
            </Button>
          </div>
        </div>
      </Modal>
    )}
    </>
  );
}
