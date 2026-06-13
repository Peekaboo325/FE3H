import { useState, useRef, useEffect } from 'react';
import Characters from './Characters';
import LorePanel from './Lore';
import Chronicle from './Chronicle';
import Guidance from './Guidance';
import Stories from './Stories';
import Menu, { type MenuItem } from './Menu';
import StoryText from './StoryText';
import LoadingIndicator from './Loading';
import { hasAnchor } from './anchorDetect';
import { stripMarkdown } from './podraScript';
import { defaultStoryTitle } from './storyTitle';
import { DialogHost } from './dialog';
import { showToast, ToastHost } from './toast';
import { UI } from './strings';
import { Copy, Check, RotateCcw, Pencil, Trash2, X, BookOpen, PenLine, Menu as MenuIcon, ChevronsDown } from 'lucide-react';

type Turn = { id?: number; role: 'user' | 'assistant'; content: string };
type Story = { id: number; title: string };
// 되짚은 자취 — 서버가 실제로 주입한 회차·문헌(확인 자취용).
type Recall = { ep?: number[]; lore?: { n: number; t: string }[] };

// 되짚은 자취를 디제틱 한 줄로: "제3화 · 제2권 퍼거스 신성 왕국"
function recallTraceText(r: Recall): string {
  const parts: string[] = [];
  if (r.ep?.length) parts.push(...r.ep.map((n) => `제${n}화`));
  if (r.lore?.length) parts.push(...r.lore.map((l) => `제${l.n}권${l.t ? ' ' + l.t : ''}`));
  return parts.join(' · ');
}

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
  const [showChronicle, setShowChronicle] = useState(false);
  const [showGuidance, setShowGuidance] = useState(false);
  const [showStories, setShowStories] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [copied, setCopied] = useState<number | null>(null);
  const [editingTurn, setEditingTurn] = useState<number | null>(null);
  const [editText, setEditText] = useState('');
  const [armedTurn, setArmedTurn] = useState<number | null>(null); // 삭제 두 번 누르기 대상
  const [pendingRecall, setPendingRecall] = useState(false); // 이번 생성이 '회상'(앵커)인가 → 로딩 톤

  // 되짚었음을 잠깐 알리는 토스트(떴다 사라짐). 본문/DB와 무관, 화면 표시뿐.
  function showRecallToast(r: Recall) {
    showToast(`회상한 기록 - ${recallTraceText(r)}`);
  }
  const [visibleCount, setVisibleCount] = useState(WINDOW); // 지금 펼쳐 둔 칸 수
  const [pendingJump, setPendingJump] = useState<number | null>(null); // 연대 문헌에서 '그 화로 가기'
  const [최신로내려가기, set최신로내려가기] = useState(false); // 위로 한참 올라갔을 때만 뜨는 '맨 아래로' FAB
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
    { label: '인물 명부', onClick: () => setShowChars(true) },
    { label: '대륙 문헌', onClick: () => setShowLore(true) },
    { label: '연대 문헌', onClick: () => setShowChronicle(true) },
    { label: '기록 지침', onClick: () => setShowGuidance(true) },
    { label: '천각의 박동', onClick: () => setShowStories(true) },
  ];

  // 특정 이야기의 본문을 불러온다. (불러온 배열을 돌려줘 새 턴 id를 잡을 수 있게)
  async function loadTurnsFor(id: number | null): Promise<Turn[]> {
    try {
      const url = id ? `/api/turns?story_id=${id}` : '/api/turns';
      const r = await fetch(url);
      const d = await r.json();
      const fresh = Array.isArray(d?.turns) ? (d.turns as Turn[]) : [];
      setTurns(fresh);
      setVisibleCount(WINDOW); // 새로 불러오면 최근 창으로 접어둔다.
      return fresh;
    } catch {
      setTurns([]);
      return [];
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

  // 새 문장이 흘러나올 때마다 맨 아래로 따라간다 — 단, '바닥 근처에 있을 때만'.
  // 위쪽 화를 수정·소각·재작성하는 중에 화면을 바닥으로 빼앗아 가지 않게(테스트·퇴고 방해 버그 수정).
  useEffect(() => {
    const sc = document.querySelector('main.scroll');
    if (!sc) return;
    const 바닥근처 = sc.scrollHeight - sc.scrollTop - sc.clientHeight < 160;
    if (바닥근처) 끝.current?.scrollIntoView({ behavior: 'smooth' });
  }, [turns, busy]);

  // 위로 한참 올라가면 우하단에 '맨 아래로' FAB를 띄운다(바닥 근처면 숨김).
  useEffect(() => {
    const sc = document.querySelector('main.scroll');
    if (!sc) return;
    const 갱신 = () => {
      const 남은거리 = sc.scrollHeight - sc.scrollTop - sc.clientHeight;
      set최신로내려가기(남은거리 > 320);
    };
    갱신(); // 진입·내용 변화 시 즉시 반영(앱은 1화 위쪽에서 시작)
    sc.addEventListener('scroll', 갱신, { passive: true });
    return () => sc.removeEventListener('scroll', 갱신);
  }, [turns.length, visibleCount, mode]);

  function 맨아래로() {
    끝.current?.scrollIntoView({ behavior: 'smooth' });
  }

  // 연대 문헌 '그 화로 가기' — 창을 넓혀 그 화가 그려지면 그곳으로 스크롤.
  useEffect(() => {
    if (pendingJump == null) return;
    const el = document.querySelector(`[data-turn-id="${pendingJump}"]`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setPendingJump(null);
    }
  }, [pendingJump, visibleCount, turns]);

  // 연대 문헌에서 지목한 화를 본문에서 펼쳐 보여준다(필요하면 창을 넓힘).
  function jumpToTurn(turnId: number) {
    const idx = turns.findIndex((t) => t.id === turnId);
    if (idx < 0) return;
    setVisibleCount((v) => Math.max(v, turns.length - idx)); // 그 화가 보이는 창 안에 들도록
    setShowChronicle(false);
    setPendingJump(turnId); // 위 effect가 렌더 후 스크롤
  }

  // 편집박스 높이를 내용 분량에 맞춰 자동 조절 — 상한 없이 내용만큼 통째로 자란다.
  // (상한을 두면 박스 '내부' 스크롤이 생기는데, iOS는 내부 스크롤에서 커서를 키보드에
  //  딱 붙여 놓아 고치기 힘들다 — 바깥(.scroll) 스크롤로 넘겨야 scroll-padding 숨통이 먹는다)
  useEffect(() => {
    const el = editRef.current;
    if (el) {
      el.style.height = 'auto';
      el.style.height = el.scrollHeight + 'px';
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
    setPendingRecall(hasAnchor(입력)); // 앵커가 있으면 로딩을 '회상' 톤으로
    // 전개는 명시적 행동 — 위에서 읽던 중이었어도 새 화가 시작되는 곳으로 내려간다.
    requestAnimationFrame(() => 끝.current?.scrollIntoView({ behavior: 'smooth' }));

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

      // 서버가 실제로 되짚은 자취(헤더, 본문 전 도착)를 읽어 토스트로 잠깐 띄운다.
      const 자취 = parseRecallHeader(res.headers.get('x-recall'));
      if (자취) showRecallToast(자취);

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let 받은 = '';
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        const 조각 = decoder.decode(value, { stream: true });
        받은 += 조각;
        붙이기(조각);
      }
      // 스트리밍 본문이 사라지지 않게: DB가 '이 답변을 같거나 더 길게 저장'했을 때만 DB판을 채택한다.
      // (연결이 조용히 끊겨 서버가 저장 못 하면, 화면에 받은 부분 본문을 그대로 남긴다 — 어디서 잘렸는지도 보임.)
      const 본문길이 = 받은.trim().length;
      if (storyId && 본문길이 > 0 && !받은.includes('[서고 오류]')) {
        // 연결만 끊기고 서버는 끝까지 생성·저장했을 수 있다 → 잠깐 폴링해 완성본을 받아온다(본문 완성+버튼 복구).
        for (let 시도 = 0; 시도 < 6; 시도++) {
          try {
            const r = await fetch(`/api/turns?story_id=${storyId}`);
            const d = await r.json();
            const fresh = Array.isArray(d?.turns) ? (d.turns as Turn[]) : [];
            const 끝 = fresh[fresh.length - 1];
            const 저장길이 = 끝?.role === 'assistant' ? (끝.content?.trim().length || 0) : -1;
            if (저장길이 >= 본문길이) {
              setTurns(fresh);
              setVisibleCount(WINDOW);
              break;
            }
          } catch {
            /* 무시 — 다음 시도 */
          }
          if (시도 < 5) await new Promise((r) => setTimeout(r, 2000)); // 2초 간격(총 ≈10초)
        }
        // 끝까지 안 보이면 화면의 부분 본문을 그대로 둔다(소각 버튼으로 치울 수 있음).
      } else if (storyId && 본문길이 === 0) {
        // 한 글자도 안 왔으면 정상 재로딩으로 빈 자리 정리.
        await loadTurnsFor(storyId);
      }
    } catch (e) {
      붙이기(`\n\n[연결 오류] ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  }

  // 응답 헤더(x-recall)를 안전하게 푼다.
  function parseRecallHeader(raw: string | null): Recall | null {
    if (!raw) return null;
    try {
      const r = JSON.parse(decodeURIComponent(raw)) as Recall;
      return (r.ep?.length || r.lore?.length) ? r : null;
    } catch {
      return null;
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
      showToast('재작성할 앞선 지시가 없습니다.');
      return;
    }

    const targetId = target.id;
    const old = target.content;
    const messages = turns.slice(0, promptIdx + 1).map((t) => ({ role: t.role, content: t.content }));

    setBusy(true);
    setPendingRecall(false); // 다시 받기는 아직 앵커 미적용 → 일반 로딩
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

  // 화 번호 — 한 번 '전개' = 한 화. N번째 본문(서술자)이 N화. (앵커링 "N화 참고"의 기준)
  let _ac = 0;
  const epNo = turns.map((t) => (t.role === 'assistant' ? ++_ac : 0));

  return (
    <div className={'page ' + mode}>
      <DialogHost />
      <ToastHost />
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
      {showChronicle && (
        <Chronicle storyId={storyId} onClose={() => setShowChronicle(false)} onJump={jumpToTurn} />
      )}
      {showGuidance && <Guidance storyId={storyId} onClose={() => setShowGuidance(false)} />}

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
            이전 화 펼치기 <span className="unfurl-rest">{start}</span>
          </button>
        )}
        {turns.slice(start).map((t, vi) => {
          const i = start + vi; // turns 원본 기준 실제 번호
          if (mode === 'read' && t.role === 'user') return null; // 읽기 모드: 프롬프트 숨김
          const editing = editingTurn != null && t.id === editingTurn;
          return (
            <div
              key={t.id ?? 'tmp-' + i}
              data-turn-id={t.id ?? undefined}
              className={t.role === 'user' ? 'turn user' : 'turn story'}
            >
              {editing ? (
                <div className="turn-edit">
                  <textarea
                    ref={editRef}
                    value={editText}
                    onChange={(e) => setEditText(e.target.value)}
                    rows={2}
                  />
                  <div className="turn-actions">
                    <button className="turn-btn" title={UI.save} onClick={() => 턴저장(editingTurn!)}>
                      <Check size={16} />
                    </button>
                    <button className="turn-btn" title={UI.cancel} onClick={() => setEditingTurn(null)}>
                      <X size={16} />
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  {t.content ? (
                    t.role === 'assistant' ? (
                      <>
                        {epNo[i] > 0 && <div className="ep-no">{epNo[i]}화</div>}
                        <StoryText content={t.content} />
                      </>
                    ) : (
                      <div className="prompt-body">{t.content}</div>
                    )
                  ) : busy ? (
                    <LoadingIndicator recall={pendingRecall} />
                  ) : null}
                  {t.content && !busy && mode === 'write' && (
                    <div className="turn-actions">
                      {t.role === 'assistant' && (
                        <button
                          className="turn-btn"
                          title={copied === i ? `${UI.copy}됨` : UI.copy}
                          onClick={() => 복사하기(i, t.content)}
                        >
                          {copied === i ? <Check size={16} /> : <Copy size={16} />}
                        </button>
                      )}
                      {t.id != null ? (
                        <>
                          {t.role === 'assistant' && (
                            <button className="turn-btn" title={UI.regen} onClick={() => 새로받기(i)}>
                              <RotateCcw size={16} />
                            </button>
                          )}
                          <button className="turn-btn" title={UI.edit} onClick={() => 턴수정시작(t)}>
                            <Pencil size={16} />
                          </button>
                          <button
                            className={'turn-btn' + (armedTurn === t.id ? ' armed' : '')}
                            title={UI.erase}
                            onClick={() => (armedTurn === t.id ? 턴삭제(t.id!) : setArmedTurn(t.id!))}
                          >
                            <Trash2 size={16} />
                          </button>
                        </>
                      ) : (
                        t.role === 'assistant' && (
                          // 저장 안 된(끊긴) 답변 — 화면에서만 치운다(소각).
                          <button
                            className="turn-btn"
                            title={UI.erase}
                            aria-label={UI.erase}
                            onClick={() => setTurns((p) => p.filter((_, idx) => idx !== i))}
                          >
                            <Trash2 size={16} />
                          </button>
                        )
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
              {busy ? <span className="spinner" /> : UI.submit}
            </button>
          </div>
        </footer>
      )}

      {turns.length > 0 && 최신로내려가기 && (
        <button
          className="to-bottom-fab"
          onClick={맨아래로}
          aria-label="가장 최근 기록으로"
          title="가장 최근 기록으로"
        >
          <ChevronsDown size={22} />
        </button>
      )}
    </div>
  );
}
