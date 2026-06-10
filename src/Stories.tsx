import { useEffect, useState } from 'react';
import { Check, X, Pencil, Copy, Trash2, Eraser, MoreHorizontal } from 'lucide-react';
import { defaultStoryTitle } from './storyTitle';
import { confirmAsk, alertAsk } from './dialog';
import { UI } from './strings';
import Modal from './Modal';
import IconButton from './IconButton';
import Spinner from './Spinner';

type Story = { id: number; title: string; updated_at?: string };

export default function Stories({
  currentStoryId,
  onSwitch,
  onClose,
}: {
  currentStoryId: number | null;
  onSwitch: (id: number, title: string) => void;
  onClose: () => void;
}) {
  const [list, setList] = useState<Story[]>([]);
  const [loading, setLoading] = useState(true);
  const [dbReady, setDbReady] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [copyingId, setCopyingId] = useState<number | null>(null);
  const [renamingId, setRenamingId] = useState<number | null>(null); // 개칭 중인 장
  const [renameText, setRenameText] = useState('');
  const [menuId, setMenuId] = useState<number | null>(null); // ⋯ 더보기 메뉴 펼친 장

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
      await alertAsk({ message: '새 이야기를 펼치지 못했습니다.', detail: d.error || undefined });
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
        await alertAsk({ message: `${UI.copy}하지 못했습니다.`, detail: d.error || undefined });
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
      await alertAsk({ message: `${UI.rename}하지 못했습니다.`, detail: d.error || undefined });
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
      await alertAsk({ message: `${UI.revert}하지 못했습니다.`, detail: d.error || undefined });
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
      await alertAsk({ message: `${UI.erase}하지 못했습니다.`, detail: d.error || undefined });
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
    <Modal onClose={onClose} title="천각의 박동">
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
    </Modal>
  );
}
