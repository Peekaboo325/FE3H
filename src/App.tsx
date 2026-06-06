import { useState, useRef, useEffect } from 'react';
import Characters from './Characters';
import LorePanel from './Lore';
import Stories from './Stories';
import Menu, { type MenuItem } from './Menu';
import StoryText from './StoryText';
import { stripMarkdown } from './podraScript';
import { defaultStoryTitle } from './storyTitle';
import { alertAsk, DialogHost } from './dialog';
import { Copy, Check, RotateCcw, Pencil, Trash2, X, BookOpen, PenLine, Menu as MenuIcon } from 'lucide-react';

type Turn = { id?: number; role: 'user' | 'assistant'; content: string };
type Story = { id: number; title: string };

const LS_STORY = 'fe3h.currentStoryId';

// 두루마리 펼침 분량 — 평소엔 최근 WINDOW칸만 그리고, 옛 칸은 STEP씩 펼친다.
// (화수가 쌓여도 화면에 살아있는 DOM을 가볍게 유지: legacy의 100화+ 공방 대비)
const WINDOW = 30;
const STEP = 30;

export default function App() {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [storyId, setStoryId] = useState<number | null>(null);
  const [storyTitle, setStoryTitle] = useState('');
  const [showChars, setShowChars] = useState(false);
  const [showLore, setShowLore] = useState(false);
  const [showStories, setShowStories] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [copied, setCopied] = useState<number | null>(null);
  const [editingTurn, setEditingTurn] = useState<number | null>(null);
  const [editText, setEditText] = useState('');
  const [armedTurn, setArmedTurn] = useState<number | null>(null); // 삭제 두 번 누르기 대상
  const [visibleCount, setVisibleCount] = useState(WINDOW); // 지금 펼쳐 둔 칸 수
  const [mode, setMode] = useState<'read' | 'write'>(
    () => (localStorage.getItem('fe3h.mode') === 'read' ? 'read' : 'write'),
  );
  const 끝 = useRef<HTMLDivElement>(null);
  const editRef = useRef<HTMLTextAreaElement>(null);
  const composeRef = useRef<HTMLTextAreaElement>(null);

  function 모드전환() {
    setMode((m) => {
      const next = m === 'read' ? 'write' : 'read';
      localStorage.setItem('fe3h.mode', next);
      return next;
    });
  }

  // 드로어 메뉴 항목 — 늘릴 땐 여기 한 줄만 추가하면 됨.
  // '천각의 박동'(이야기/세이브)은 가장 아래에 둔다.
  const menuItems: MenuItem[] = [
    { label: '인물', onClick: () => setShowChars(true) },
    { label: '견문록', onClick: () => setShowLore(true) },
    { label: '천각의 박동', onClick: () => setShowStories(true) },
  ];

  // 특정 이야기의 본문을 불러온다.
  async function loadTurnsFor(id: number | null) {
    try {
      const url = id ? `/api/turns?story_id=${id}` : '/api/turns';
      const r = await fetch(url);
      const d = await r.json();
      setTurns(Array.isArray(d?.turns) ? (d.turns as Turn[]) : []);
      setVisibleCount(WINDOW); // 새로 불러오면 최근 창으로 접어둔다.
    } catch {
      setTurns([]);
    }
  }

  // 화면을 켜면 '현재 이야기'를 정하고(없으면 만들고) 그 본문을 복원한다.
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch('/api/stories');
        const data = await res.json();
        if (!data.dbReady) {
          // Supabase 미설정 — 이야기 개념 없이 동작(휘발).
          loadTurnsFor(null);
          return;
        }
        const list: Story[] = Array.isArray(data.stories) ? data.stories : [];
        const saved = Number(localStorage.getItem(LS_STORY)) || null;
        let cur: Story | undefined = saved ? list.find((s) => s.id === saved) : undefined;
        if (!cur) cur = list[0];
        if (!cur) {
          // 하나도 없으면 기본 이야기 생성.
          const cr = await fetch('/api/stories', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ title: defaultStoryTitle(1) }),
          });
          const cd = await cr.json();
          cur = cd.story;
        }
        if (!alive || !cur) return;
        setStoryId(cur.id);
        setStoryTitle(cur.title);
        localStorage.setItem(LS_STORY, String(cur.id));
        loadTurnsFor(cur.id);
      } catch {
        /* 무시 — 빈 화면으로 시작 */
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  // 새 문장이 흘러나올 때마다 맨 아래로 따라간다.
  useEffect(() => {
    끝.current?.scrollIntoView({ behavior: 'smooth' });
  }, [turns, busy]);

  // 편집박스 높이를 내용 분량에 맞춰 자동 조절(짧으면 작게, 길면 커지되 70vh 상한).
  useEffect(() => {
    const el = editRef.current;
    if (el) {
      el.style.height = 'auto';
      el.style.height = Math.min(el.scrollHeight, window.innerHeight * 0.7) + 'px';
    }
  }, [editText, editingTurn]);

  // 입력칸도 분량에 맞춰 자동 높이(처음 1줄 → 줄바꿈 시 늘어남, 40vh 상한).
  useEffect(() => {
    const el = composeRef.current;
    if (el) {
      el.style.height = 'auto';
      el.style.height = Math.min(el.scrollHeight, window.innerHeight * 0.4) + 'px';
    }
  }, [input]);

  // 이야기 전환(불러오기).
  function switchStory(id: number, title: string) {
    setStoryId(id);
    setStoryTitle(title);
    localStorage.setItem(LS_STORY, String(id));
    setTurns([]);
    loadTurnsFor(id);
    setShowStories(false);
  }

  async function 보내기() {
    const 입력 = input.trim();
    if (!입력 || busy) return;

    const 다음: Turn[] = [...turns, { role: 'user', content: 입력 }, { role: 'assistant', content: '' }];
    setTurns(다음);
    setInput('');
    setBusy(true);

    const messages = 다음.slice(0, -1).map((t) => ({ role: t.role, content: t.content }));

    try {
      const res = await fetch('/api/story', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ messages, story_id: storyId }),
      });

      if (!res.ok || !res.body) {
        const 사유 = await res.text();
        붙이기(사유 || '[연결 오류]');
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        붙이기(decoder.decode(value, { stream: true }));
      }
      // 새 턴의 DB id를 받아오기 위해 다시 불러온다(수정·삭제 대상이 되도록).
      if (storyId) await loadTurnsFor(storyId);
    } catch (e) {
      붙이기(`\n\n[연결 오류] ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  }

  // 결과값을 평문(마크다운 제거)으로 클립보드에 복사.
  async function 복사하기(i: number, text: string) {
    try {
      await navigator.clipboard.writeText(stripMarkdown(text));
      setCopied(i);
      setTimeout(() => setCopied((c) => (c === i ? null : c)), 1500);
    } catch {
      /* 클립보드 거부 — 무시 */
    }
  }

  // 턴(프롬프트/결과) 개별 수정·삭제 — 낙관적 업데이트 + 서버 반영.
  function 턴수정시작(t: Turn) {
    if (t.id == null) return;
    setEditingTurn(t.id);
    setEditText(t.content);
  }

  async function 턴저장(id: number) {
    const content = editText;
    setTurns((prev) => prev.map((x) => (x.id === id ? { ...x, content } : x)));
    setEditingTurn(null);
    try {
      await fetch('/api/turns', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ id, content }),
      });
    } catch {
      /* 무시 */
    }
  }

  async function 턴삭제(id: number) {
    setArmedTurn(null);
    setTurns((prev) => prev.filter((x) => x.id !== id));
    if (editingTurn === id) setEditingTurn(null);
    try {
      await fetch(`/api/turns?id=${id}`, { method: 'DELETE' });
    } catch {
      /* 무시 */
    }
  }

  // 한 답변 '새로 받기' — 앞 대화 + 그 프롬프트만 반영해 그 칸만 다시 씀(뒤는 그대로).
  async function 새로받기(turnIndex: number) {
    if (busy) return;
    const target = turns[turnIndex];
    if (!target || target.id == null || target.role !== 'assistant') return;

    // 매칭된 프롬프트 = 이 답변 앞쪽에서 가장 가까운 유저 턴.
    let promptIdx = -1;
    for (let k = turnIndex - 1; k >= 0; k--) {
      if (turns[k].role === 'user') {
        promptIdx = k;
        break;
      }
    }
    if (promptIdx < 0) {
      await alertAsk({ message: '앞에 프롬프트가 없어 새로 받을 수 없어요.' });
      return;
    }

    const targetId = target.id;
    const old = target.content;
    const messages = turns.slice(0, promptIdx + 1).map((t) => ({ role: t.role, content: t.content }));

    setBusy(true);
    setEditingTurn(null);
    setTurns((prev) => prev.map((x) => (x.id === targetId ? { ...x, content: '' } : x)));

    let 본문 = '';
    try {
      const res = await fetch('/api/regen', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ messages, story_id: storyId, turn_id: targetId }),
      });
      if (!res.ok || !res.body) {
        const e = await res.text();
        setTurns((prev) => prev.map((x) => (x.id === targetId ? { ...x, content: e || old } : x)));
        return;
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        본문 += decoder.decode(value, { stream: true });
        setTurns((prev) => prev.map((x) => (x.id === targetId ? { ...x, content: 본문 } : x)));
      }
      if (!본문.trim()) {
        setTurns((prev) => prev.map((x) => (x.id === targetId ? { ...x, content: old } : x)));
      }
    } catch (e) {
      console.error(e);
      setTurns((prev) => prev.map((x) => (x.id === targetId ? { ...x, content: old } : x)));
    } finally {
      setBusy(false);
    }
  }

  function 붙이기(조각: string) {
    setTurns((prev) => {
      const copy = [...prev];
      const last = copy[copy.length - 1];
      if (last && last.role === 'assistant') {
        copy[copy.length - 1] = { ...last, content: last.content + 조각 };
      }
      return copy;
    });
  }

  // 보이는 창 = 최근 visibleCount칸. start 위쪽은 '말아둔 두루마리'로 접어둔다.
  const start = Math.max(0, turns.length - visibleCount);

  return (
    <div className={'page ' + mode}>
      <DialogHost />
      <header className="head">
        <button className="hamburger" onClick={() => setMenuOpen(true)} aria-label="메뉴">
          <MenuIcon size={17} />
        </button>
        <p className="story-tag">{storyTitle}</p>
        <button
          className="mode-toggle"
          onClick={모드전환}
          title={mode === 'read' ? '집필 모드로' : '읽기 모드로'}
        >
          {mode === 'read' ? <PenLine size={17} /> : <BookOpen size={17} />}
        </button>
      </header>

      <Menu
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        subtitle={storyTitle || undefined}
        items={menuItems}
      />

      {showStories && (
        <Stories currentStoryId={storyId} onSwitch={switchStory} onClose={() => setShowStories(false)} />
      )}
      {showChars && <Characters storyId={storyId} onClose={() => setShowChars(false)} />}
      {showLore && <LorePanel storyId={storyId} onClose={() => setShowLore(false)} />}

      <main className="scroll">
        <div className="scroll-inner">
        {turns.length === 0 && (
          <p className="hint">여신의 시선이 머문 첫 순간을 기록하십시오.</p>
        )}
        {start > 0 && (
          <button
            className="unfurl"
            onClick={() => setVisibleCount((c) => c + STEP)}
            title="앞선 장면을 더 펼칩니다"
          >
            ❧ 이전 두루마리 펼치기 <span className="unfurl-rest">· 묵은 장 {start}</span>
          </button>
        )}
        {turns.slice(start).map((t, vi) => {
          const i = start + vi; // turns 원본 기준 실제 번호
          if (mode === 'read' && t.role === 'user') return null; // 읽기 모드: 프롬프트 숨김
          const editing = editingTurn != null && t.id === editingTurn;
          return (
            <div key={t.id ?? 'tmp-' + i} className={t.role === 'user' ? 'turn user' : 'turn story'}>
              {editing ? (
                <div className="turn-edit">
                  <textarea
                    ref={editRef}
                    value={editText}
                    onChange={(e) => setEditText(e.target.value)}
                    rows={2}
                  />
                  <div className="turn-actions">
                    <button className="turn-btn" title="새김" onClick={() => 턴저장(editingTurn!)}>
                      <Check size={16} />
                    </button>
                    <button className="turn-btn" title="철회" onClick={() => setEditingTurn(null)}>
                      <X size={16} />
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  {t.content ? (
                    t.role === 'assistant' ? (
                      <StoryText content={t.content} />
                    ) : (
                      <div className="prompt-body">{t.content}</div>
                    )
                  ) : busy ? (
                    <span className="dim">…집필 중…</span>
                  ) : null}
                  {t.content && !busy && mode === 'write' && (
                    <div className="turn-actions">
                      {t.role === 'assistant' && (
                        <button
                          className="turn-btn"
                          title={copied === i ? '필사됨' : '필사'}
                          onClick={() => 복사하기(i, t.content)}
                        >
                          {copied === i ? <Check size={16} /> : <Copy size={16} />}
                        </button>
                      )}
                      {t.id != null && (
                        <>
                          {t.role === 'assistant' && (
                            <button className="turn-btn" title="다시 받기" onClick={() => 새로받기(i)}>
                              <RotateCcw size={16} />
                            </button>
                          )}
                          <button className="turn-btn" title="고침" onClick={() => 턴수정시작(t)}>
                            <Pencil size={16} />
                          </button>
                          <button
                            className={'turn-btn' + (armedTurn === t.id ? ' armed' : '')}
                            title="소각"
                            onClick={() => (armedTurn === t.id ? 턴삭제(t.id!) : setArmedTurn(t.id!))}
                          >
                            <Trash2 size={16} />
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          );
        })}
        <div ref={끝} />
        </div>
      </main>

      {mode === 'write' && (
        <footer className="compose">
          <div className="compose-inner">
            <textarea
              ref={composeRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key !== 'Enter') return;
                if (e.nativeEvent.isComposing) return; // 한글 조합 중 엔터 무시
                if (window.matchMedia('(pointer: coarse)').matches) return; // 모바일: 엔터=줄바꿈
                if (e.shiftKey) return; // Shift+Enter = 줄바꿈
                e.preventDefault(); // 데스크탑: 엔터 = 전송
                보내기();
              }}
              placeholder="운명의 장을 이어가십시오."
              rows={1}
              disabled={busy}
            />
            <button onClick={보내기} disabled={busy || !input.trim()}>
              {busy ? '집필 중…' : '전개'}
            </button>
          </div>
        </footer>
      )}
    </div>
  );
}
