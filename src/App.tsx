import { useState, useRef, useEffect } from 'react';
import Characters from './Characters';
import SupplyMenu from './SupplyMenu';
import { type GenConfig } from './Settings';
import LorePanel from './Lore';
import Chronicle from './Chronicle';
import Guidance from './Guidance';
import Stories from './Stories';
import Menu, { type MenuItem } from './Menu';
import StoryText from './StoryText';
import AutoTextarea from './AutoTextarea';
import LoadingIndicator from './Loading';
import { hasAnchor } from './anchorDetect';
import { stripMarkdown } from './podraScript';
import { defaultStoryTitle } from './storyTitle';
import { DialogHost } from './dialog';
import { showToast, ToastHost } from './toast';
import { UI } from './strings';
import { Copy, Check, RotateCcw, Pencil, Trash2, X, BookOpen, PenLine, Menu as MenuIcon, ChevronsDown, Sparkles, Undo2 } from 'lucide-react';

// polished = 교정본(딥시크가 위반 구문만 다듬은 변형, null=없음). polished_show = 지금 교정본을 보는 중인지.
//  원본(content)은 이야기 연속성의 기준(요약·앵커가 읽음). 교정본은 읽기용 변형 — 자유 토글.
type Turn = {
  id?: number;
  role: 'user' | 'assistant';
  content: string;
  _key?: string;
  draft?: boolean;
  seed?: string;
  polished?: string;
  polished_show?: boolean;
};

// 화면에 보일 본문 — 교정본을 보는 중이고 교정본이 있으면 그걸, 아니면 원본.
//  (교정 스트림 시작 직후 polished=''(빈 문자열)은 falsy → 원본으로 떨어져 깜빡임 없음.)
const 표시본 = (t: Turn) => (t.polished_show && t.polished ? t.polished : t.content);

// 전개된 유저 말풍선 = '[초안](작가 1차 방향)' + '[연출](콘티)' 합본. 표시용으로 두 구역을 갈라낸다.
//  새 형식: "[초안]\n…\n\n[연출]\n…"   / 옛 형식(잔존 데이터): "…\n\n---\n\n…"  둘 다 인식.
function 합본분해(content: string): { seed: string; colt: string } | null {
  const m = content.match(/^\[초안\]\n([\s\S]*?)\n\n\[연출\]\n([\s\S]*)$/);
  if (m) return { seed: m[1].trim(), colt: m[2].trim() };
  const old = content.match(/^([\s\S]*?)\n\n---\n\n([\s\S]*)$/); // 옛 --- 구분자 하위호환
  if (old) return { seed: old[1].trim(), colt: old[2].trim() };
  return null;
}

// 유저 말풍선 본문 — 초안+연출 합본이면 [초안]/[연출] 캡션과 흐린 결로 나눠 그린다(밋밋한 --- 대체).
function UserBody({ content }: { content: string }) {
  const parts = 합본분해(content);
  if (!parts) return <div className="prompt-body">{content}</div>;
  return (
    <div className="prompt-body prompt-composed">
      <div className="composed-cap">[초안]</div>
      <div className="composed-seed">{parts.seed}</div>
      <div className="composed-sep" />
      <div className="composed-cap">[연출]</div>
      <div className="composed-colt">{parts.colt}</div>
    </div>
  );
}

type Story = { id: number; title: string };
// 되짚은 자취 — 서버가 실제로 주입한 회차·문헌(확인 자취용).
type Recall = { ep?: number[]; lore?: { n: number; t: string }[]; char?: string[] };
// 되짚으려 했으나 못 살린 것 — 조용한 실패를 없애 작가가 결과를 본다.
type RecallNote = {
  epMiss?: number[]; // 아직 없는 회차
  epBrief?: boolean; // 회차는 있으나 추려내기 실패
  loreMiss?: boolean; // 지목 문헌 못 찾음
  charHere?: string[]; // 이미 함께 있는 인물
  charMiss?: string[]; // 명부에 없는 이름
};

// 되짚은 자취를 디제틱 한 줄로: "제3화 · 제2권 퍼거스 신성 왕국 · 펠릭스"
function recallTraceText(r: Recall): string {
  const parts: string[] = [];
  if (r.ep?.length) parts.push(...r.ep.map((n) => `제${n}화`));
  if (r.lore?.length) parts.push(...r.lore.map((l) => `제${l.n}권${l.t ? ' ' + l.t : ''}`));
  if (r.char?.length) parts.push(...r.char);
  return parts.join(' · ');
}

// 자취(살린 것) + 안내(못 살린 것)를 한 토스트 문구로. 둘 다 없으면 null.
function recallMessage(r: Recall | null, note: RecallNote | null): string | null {
  const parts: string[] = [];
  if (r) parts.push(`회상한 기록 - ${recallTraceText(r)}`);
  if (note?.charHere?.length) parts.push(`이미 함께 있습니다 - ${note.charHere.join(' · ')}`);
  const miss: string[] = [];
  if (note?.epMiss?.length) miss.push(`아직 없는 회차 ${note.epMiss.map((n) => `제${n}화`).join(' · ')}`);
  if (note?.epBrief) miss.push('회차를 추려내지 못했습니다');
  if (note?.loreMiss) miss.push('지목한 문헌을 찾지 못했습니다');
  if (note?.charMiss?.length) miss.push(`명부에 없는 인물 ${note.charMiss.join(' · ')}`);
  if (miss.length) parts.push(`되짚지 못함 - ${miss.join(', ')}`);
  return parts.length ? parts.join('   ·   ') : null;
}

const LS_STORY = 'fe3h.currentStoryId';

// 두루마리 펼침 분량 — 평소엔 최근 WINDOW칸만 그리고, 옛 칸은 STEP씩 펼친다.
// (화수가 쌓여도 화면에 살아있는 DOM을 가볍게 유지: legacy의 100화+ 공방 대비)
const WINDOW = 30;
const STEP = 30;

// 턴별 '고정 클라이언트 키' 발급기 — 스트리밍 칸이 완료 시 id를 얻어도 React key가 안 바뀌게(리마운트=스크롤 튐 방지).
let _kc = 0;
const nk = () => 'ck' + ++_kc;

// 본문 생성 설정(모델·사고 깊이) — 빌더가 앱 '설정'에서 고르고 localStorage에 남는다. /api/story·regen 본문으로 보냄.
const GEN_KEY = 'genCfg';
const DEFAULT_GEN: GenConfig = { model: 'deepseek-v4-pro', effort: 'medium', enrich: true }; // Opus 잠깐 걷어둠(2026-06-19, 비용). 연출 콘티 기본 켬(딥시크 보강)
function loadGenCfg(): GenConfig {
  try {
    const p = JSON.parse(localStorage.getItem(GEN_KEY) || 'null');
    if (p && typeof p === 'object')
      return {
        model: p.model || DEFAULT_GEN.model,
        effort: p.effort || DEFAULT_GEN.effort,
        enrich: p.enrich !== false,
      };
  } catch {
    /* 기본값으로 */
  }
  return DEFAULT_GEN;
}

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
  const [showSupply, setShowSupply] = useState(false);
  const [genCfg, setGenCfg] = useState<GenConfig>(loadGenCfg);
  function 설정변경(c: GenConfig) {
    setGenCfg(c);
    try {
      localStorage.setItem(GEN_KEY, JSON.stringify(c));
    } catch {
      /* 저장 실패해도 이번 세션엔 적용됨 */
    }
  }
  const [showStories, setShowStories] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [copied, setCopied] = useState<number | null>(null);
  const [editingTurn, setEditingTurn] = useState<number | null>(null);
  const [editText, setEditText] = useState('');
  const [draftEdit, setDraftEdit] = useState<number | null>(null); // 콘티 초안 인라인 편집 중인 turn 인덱스
  const [armedTurn, setArmedTurn] = useState<number | null>(null); // 삭제 두 번 누르기 대상
  const [pendingRecall, setPendingRecall] = useState(false); // 이번 생성이 '회상'(앵커)인가 → 로딩 톤

  const [visibleCount, setVisibleCount] = useState(WINDOW); // 지금 펼쳐 둔 칸 수
  const [pendingJump, setPendingJump] = useState<number | null>(null); // 연대 문헌에서 '그 화로 가기'
  const [최신로내려가기, set최신로내려가기] = useState(false); // 위로 한참 올라갔을 때만 뜨는 '맨 아래로' FAB
  const [mode, setMode] = useState<'read' | 'write'>(
    () => (localStorage.getItem('fe3h.mode') === 'read' ? 'read' : 'write'),
  );
  const 끝 = useRef<HTMLDivElement>(null);
  const 붙어있기 = useRef(true); // 바닥에 '붙어' 자동으로 따라갈지 — 위로 올라가 읽으면 false(따라가기 멈춤)
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
    { label: '물자 조달', onClick: () => setShowSupply(true) },
    { label: '대륙 문헌', divider: true, onClick: () => setShowLore(true) },
    { label: '연대 문헌', onClick: () => setShowChronicle(true) },
    { label: '기록 지침', divider: true, onClick: () => setShowGuidance(true) },
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

  // 새 문장이 흘러나오는 동안 맨 아래로 따라간다 — 단 '바닥에 붙어 있을 때만'(붙어있기).
  // 위로 올라가 읽기 시작하면(스크롤 리스너가 붙어있기=false) 그 순간부터 따라가지 않는다 —
  //  스트리밍 중에도, 완료 시에도 읽던 화면을 빼앗지 않게. behavior 생략=즉시 이동(smooth가
  //  청크마다 겹쳐 '이리저리' 튀던 것 방지).
  useEffect(() => {
    if (붙어있기.current) 끝.current?.scrollIntoView({ block: 'end' });
  }, [turns, busy]);

  // 위로 한참 올라가면 우하단에 '맨 아래로' FAB를 띄운다(바닥 근처면 숨김).
  useEffect(() => {
    const sc = document.querySelector('main.scroll');
    if (!sc) return;
    const 갱신 = () => {
      const 남은거리 = sc.scrollHeight - sc.scrollTop - sc.clientHeight;
      붙어있기.current = 남은거리 < 120; // 바닥 근처면 따라가기 유지, 위로 올라가면 멈춤
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

  // (수정칸 자동 높이는 src/AutoTextarea.tsx가 자체 처리 — 초안·일반 수정 둘 다 그 컴포넌트를 쓴다.)

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

  // 전개 버튼 — 딥시크면 '연출 콘티(2차)'부터 펼쳐 게이트로, Opus면 바로 본문.
  async function 보내기() {
    const 입력 = input.trim();
    if (!입력 || busy) return;
    if (genCfg.model.startsWith('deepseek') && genCfg.enrich) {
      await 콘티생성(입력); // 콘티 말풍선 → 실행 게이트(딥시크 + 연출 콘티 켬)
      return;
    }
    const 다음: Turn[] = [
      ...turns,
      { role: 'user', content: 입력, _key: nk() },
      { role: 'assistant', content: '', _key: nk() },
    ];
    setInput('');
    await 본문스트리밍(다음, 입력);
  }

  // 연출 콘티 펼치기 — 짧은 1차를 2차 콘티로(/api/story?enrich). 결과는 'draft' 유저 말풍선으로(실행 전).
  async function 콘티생성(seed: string) {
    setBusy(true);
    setInput('');
    try {
      const res = await fetch('/api/story', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ enrich: true, prompt: seed, story_id: storyId }),
      });
      const d = await res.json().catch(() => ({}) as { colt?: string; error?: string });
      if (!res.ok || d.error || !d.colt) {
        showToast(d.error || '연출을 펼치지 못했습니다 — 다시 시도하십시오.');
        setInput(seed); // 잃지 않게 1차 복원
        return;
      }
      setTurns((p) => [...p, { role: 'user', content: d.colt!, _key: nk(), draft: true, seed }]);
      붙어있기.current = true;
      requestAnimationFrame(() => 끝.current?.scrollIntoView({ behavior: 'smooth' }));
    } catch {
      showToast('연출을 펼치지 못했습니다 — 다시 시도하십시오.');
      setInput(seed);
    } finally {
      setBusy(false);
    }
  }

  // 콘티 새로고침 — 같은 1차에서 다른 2차로.
  async function 콘티새로고침(i: number) {
    if (busy) return;
    const seed = turns[i]?.seed;
    if (!seed) return;
    setBusy(true);
    try {
      const res = await fetch('/api/story', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ enrich: true, prompt: seed, story_id: storyId }),
      });
      const d = await res.json().catch(() => ({}) as { colt?: string; error?: string });
      if (!res.ok || d.error || !d.colt) {
        showToast(d.error || '연출을 다시 펼치지 못했습니다.');
        return;
      }
      setTurns((p) => p.map((t, idx) => (idx === i ? { ...t, content: d.colt! } : t)));
    } catch {
      showToast('연출을 다시 펼치지 못했습니다.');
    } finally {
      setBusy(false);
    }
  }

  // 콘티 삭제 — 초안 접고 1차를 입력창으로 되돌린다.
  function 콘티삭제(i: number) {
    setInput(turns[i]?.seed || turns[i]?.content || '');
    setDraftEdit(null);
    setTurns((p) => p.filter((_, idx) => idx !== i));
  }

  // 실행 — 콘티(2차)를 확정하고 그걸 프롬프트로 딥시크 본문 생성.
  //   ⚠️ 1차 원문(seed)도 함께 묶어 보낸다 — 콘티가 압축하다 떨군 사실(5년/1년 등)을
  //   작가가 친 글자 그대로 딥시크 입력에 박아, 본문에서 사라지지 않게 한다(빌더 결정 2026-06-23).
  async function 실행(i: number) {
    if (busy) return;
    const colt = turns[i]?.content || '';
    const seed = turns[i]?.seed || '';
    // [초안](작가 1차 방향) + [연출](콘티) 라벨 합본 — 표시가 두 구역으로 갈라 그리고, 모델도 라벨로 둘을 구분.
    const 합본 = seed ? `[초안]\n${seed}\n\n[연출]\n${colt}` : colt;
    const 다음: Turn[] = [
      ...turns.map((t, idx) => (idx === i ? { ...t, content: 합본, draft: undefined, seed: undefined } : t)),
      { role: 'assistant', content: '', _key: nk() },
    ];
    await 본문스트리밍(다음, 합본);
  }

  // 본문 스트리밍 — 마지막(빈 assistant) 칸에 본문을 흘려 넣는다. 전개·실행 공용.
  async function 본문스트리밍(다음: Turn[], anchorText: string) {
    setTurns(다음);
    setBusy(true);
    setPendingRecall(hasAnchor(anchorText)); // 앵커가 있으면 로딩을 '회상' 톤으로
    // 전개는 명시적 행동 — 위에서 읽던 중이었어도 새 화가 시작되는 곳으로 내려가고, 따라가기를 켠다.
    붙어있기.current = true;
    requestAnimationFrame(() => 끝.current?.scrollIntoView({ behavior: 'smooth' }));

    const messages = 다음.slice(0, -1).map((t) => ({ role: t.role, content: t.content }));

    try {
      const res = await fetch('/api/story', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ messages, story_id: storyId, model: genCfg.model, effort: genCfg.effort }),
      });

      if (!res.ok || !res.body) {
        const 사유 = await res.text();
        붙이기(사유 || '[연결 오류]');
        return;
      }

      // 서버가 되짚은 자취(살린 것)와 안내(못 살린 것)를 헤더에서 읽어 한 토스트로 띄운다.
      const 자취 = parseRecallHeader(res.headers.get('x-recall'));
      const 안내 = parseNoteHeader(res.headers.get('x-recall-note'));
      const 문구 = recallMessage(자취, 안내);
      if (문구) showToast(문구);

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
        //  ⚠️ 마지막 턴 하나만 확인한다(?last=1) — 전 회차를 다시 받지 않는다(egress 절감).
        for (let 시도 = 0; 시도 < 6; 시도++) {
          try {
            const r = await fetch(`/api/turns?story_id=${storyId}&last=1`);
            const d = await r.json();
            const 끝 = Array.isArray(d?.turns) ? (d.turns as Turn[])[d.turns.length - 1] : null;
            const 저장길이 = 끝?.role === 'assistant' ? (끝.content?.trim().length || 0) : -1;
            if (끝 && 저장길이 >= 본문길이) {
              // 화면의 마지막 칸이 스트리밍 placeholder(id 없음·_key 있음)면 저장된 id·최종 본문을 제자리 패치.
              //  _key는 유지 → 리마운트 없음(스크롤 튐 방지). 구조가 예상과 다르면 그대로 둔다(부분 본문 유지).
              setTurns((prev) => {
                const last = prev[prev.length - 1];
                if (last && last.id == null && last._key) {
                  const patched = prev.slice();
                  patched[patched.length - 1] = { ...(끝 as Turn), _key: last._key };
                  return patched;
                }
                return prev;
              });
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
      return (r.ep?.length || r.lore?.length || r.char?.length) ? r : null;
    } catch {
      return null;
    }
  }

  // 응답 헤더(x-recall-note = 못 살린 것)를 안전하게 푼다.
  function parseNoteHeader(raw: string | null): RecallNote | null {
    if (!raw) return null;
    try {
      const n = JSON.parse(decodeURIComponent(raw)) as RecallNote;
      return n.epMiss?.length || n.epBrief || n.loreMiss || n.charHere?.length || n.charMiss?.length
        ? n
        : null;
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
    setEditText(표시본(t)); // 보고 있는 것을 편집 — 교정본 보는 중이면 교정본, 아니면 원본
  }

  async function 턴저장(id: number) {
    const text = editText;
    const t = turns.find((x) => x.id === id);
    const 교정본보는중 = !!(t && t.polished != null && t.polished_show);
    setEditingTurn(null);
    if (교정본보는중) {
      // 교정본을 수정 → polished만 갱신(원본·요약 불변, 복원하면 원본 그대로).
      setTurns((prev) => prev.map((x) => (x.id === id ? { ...x, polished: text } : x)));
      try {
        await fetch('/api/turns', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ id, polished: text }),
        });
      } catch {
        /* 무시 */
      }
      return;
    }
    // 원본을 수정 → content 갱신. 기존 교정본은 낡으니 비우고 보기를 원본으로(서버 updateTurn도 같이 비움).
    setTurns((prev) => prev.map((x) => (x.id === id ? { ...x, content: text, polished: undefined, polished_show: false } : x)));
    try {
      await fetch('/api/turns', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ id, content: text }),
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
    setPendingRecall(hasAnchor(messages[messages.length - 1]?.content || '')); // 다시받기도 앵커 적용 — 회상 로딩 톤
    setEditingTurn(null);
    // 재작성 = 새 원본 → 기존 교정본 슬롯 리셋(스트림이 원본 자리에 보이도록 보기도 원본으로).
    setTurns((prev) => prev.map((x) => (x.id === targetId ? { ...x, content: '', polished: undefined, polished_show: false } : x)));

    let 본문 = '';
    try {
      const res = await fetch('/api/regen', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ messages, story_id: storyId, turn_id: targetId, model: genCfg.model, effort: genCfg.effort }),
      });
      if (!res.ok || !res.body) {
        const e = await res.text();
        setTurns((prev) => prev.map((x) => (x.id === targetId ? { ...x, content: e || old } : x)));
        return;
      }
      // 되짚은 자취·안내를 헤더에서 읽어 토스트(전개와 동일) — 다시받기도 앵커 반영.
      const 문구 = recallMessage(
        parseRecallHeader(res.headers.get('x-recall')),
        parseNoteHeader(res.headers.get('x-recall-note')),
      );
      if (문구) showToast(문구);
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

  // 교정 — 한 화의 원본을 딥시크가 위반 구문만 다듬어 교정본을 만든다(스트리밍). 원본은 그대로.
  async function 교정하기(turnIndex: number) {
    if (busy) return;
    const target = turns[turnIndex];
    if (!target || target.id == null || target.role !== 'assistant') return;
    const targetId = target.id;
    setBusy(true);
    setEditingTurn(null);
    // 교정본을 빈칸으로 시작 + 보기를 교정본으로 → 스트림이 그 자리에 쌓인다.
    setTurns((prev) => prev.map((x) => (x.id === targetId ? { ...x, polished: '', polished_show: true } : x)));
    let 교정 = '';
    try {
      const res = await fetch('/api/story', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ polish: true, turn_id: targetId, story_id: storyId }),
      });
      if (!res.ok || !res.body) {
        const e = await res.text();
        setTurns((prev) => prev.map((x) => (x.id === targetId ? { ...x, polished: undefined, polished_show: false } : x)));
        showToast(e || '본문을 교정하지 못했습니다.');
        return;
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        교정 += decoder.decode(value, { stream: true });
        setTurns((prev) => prev.map((x) => (x.id === targetId ? { ...x, polished: 교정 } : x)));
      }
      if (!교정.trim()) {
        setTurns((prev) => prev.map((x) => (x.id === targetId ? { ...x, polished: undefined, polished_show: false } : x)));
        showToast('교정 결과가 비어 돌아왔습니다.');
      } else {
        showToast('본문 교정을 마쳤습니다.');
      }
    } catch (e) {
      console.error(e);
      setTurns((prev) => prev.map((x) => (x.id === targetId ? { ...x, polished: undefined, polished_show: false } : x)));
      showToast('본문을 교정하지 못했습니다.');
    } finally {
      setBusy(false);
    }
  }

  // 보기 전환(원본↔교정본) — 호출 없이 캐시된 교정본을 보여주거나 원본으로 되돌린다. 선택은 서버에 영속화.
  async function 보기전환(turnIndex: number, show: boolean) {
    const target = turns[turnIndex];
    if (!target || target.id == null) return;
    const targetId = target.id;
    setTurns((prev) => prev.map((x) => (x.id === targetId ? { ...x, polished_show: show } : x)));
    try {
      await fetch('/api/turns', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ id: targetId, polished_show: show }),
      });
    } catch {
      /* 무시 — 이번 세션엔 적용됨 */
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
  // 펼치기 버튼의 카운트 = 숨긴 것 중 'AI 답변(화)'만 — 프롬프트는 세지 않는다(화=서술자 본문).
  const 묵은화수 = turns.slice(0, start).filter((t) => t.role !== 'user').length;

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
        <Stories
          currentStoryId={storyId}
          onSwitch={switchStory}
          onClose={() => setShowStories(false)}
          genConfig={genCfg}
          onGenChange={설정변경}
        />
      )}
      {showChars && <Characters storyId={storyId} onClose={() => setShowChars(false)} />}
      {showSupply && <SupplyMenu storyId={storyId} onClose={() => setShowSupply(false)} />}
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
            이전 화 펼치기 <span className="unfurl-rest">{묵은화수}</span>
          </button>
        )}
        {turns.slice(start).map((t, vi) => {
          const i = start + vi; // turns 원본 기준 실제 번호
          if (mode === 'read' && t.role === 'user') return null; // 읽기 모드: 프롬프트 숨김
          const editing = editingTurn != null && t.id === editingTurn;
          // 연출 콘티 초안(2차) — 실행 전 게이트. 본문 칸과 별개 경로(본류 렌더 안 건드림).
          if (t.draft) {
            const dEditing = draftEdit === i;
            return (
              <div key={t._key ?? 'draft-' + i} className="turn user turn-draft">
                <div className="draft-label">전개 초안</div>
                {dEditing ? (
                  <div className="turn-edit">
                    <AutoTextarea value={editText} onChange={setEditText} />
                    <div className="turn-actions">
                      <button
                        className="turn-btn"
                        title={UI.save}
                        onClick={() => {
                          setTurns((p) => p.map((x, idx) => (idx === i ? { ...x, content: editText } : x)));
                          setDraftEdit(null);
                        }}
                      >
                        <Check size={16} />
                      </button>
                      <button className="turn-btn" title={UI.cancel} onClick={() => setDraftEdit(null)}>
                        <X size={16} />
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    {t.seed && (
                      <>
                        <div className="composed-cap">[초안]</div>
                        <div className="prompt-body draft-seed">{t.seed}</div>
                        <div className="draft-sep" />
                        <div className="composed-cap">[연출]</div>
                      </>
                    )}
                    <div className="prompt-body">{t.content}</div>
                    {mode === 'write' && (
                      <div className={'turn-actions' + (busy ? ' turn-actions--busy' : '')}>
                        <button className="turn-btn draft-run" onClick={() => 실행(i)} disabled={busy}>
                          실행
                        </button>
                        <button className="turn-btn" title={UI.regen} onClick={() => 콘티새로고침(i)} disabled={busy}>
                          <RotateCcw size={16} />
                        </button>
                        <button
                          className="turn-btn"
                          title={UI.edit}
                          onClick={() => {
                            setEditText(t.content);
                            setDraftEdit(i);
                          }}
                        >
                          <Pencil size={16} />
                        </button>
                        <button className="turn-btn" title={UI.erase} onClick={() => 콘티삭제(i)}>
                          <Trash2 size={16} />
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>
            );
          }
          return (
            <div
              key={t._key ?? t.id ?? 'tmp-' + i}
              data-turn-id={t.id ?? undefined}
              className={t.role === 'user' ? 'turn user' : 'turn story'}
            >
              {editing ? (
                <div className="turn-edit">
                  <AutoTextarea value={editText} onChange={setEditText} />
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
                        <StoryText content={표시본(t)} />
                      </>
                    ) : (
                      <UserBody content={t.content} />
                    )
                  ) : busy ? (
                    <LoadingIndicator recall={pendingRecall} />
                  ) : null}
                  {t.content && mode === 'write' && (
                    // 생성 중엔 버튼을 DOM에서 빼지 않고 자리만 지킨다(흐리게+못 누르게) — 빼면 완료 시
                    //  모든 칸의 버튼 줄이 한꺼번에 되살아나 위쪽으로 스크롤이 튄다(모바일에서 특히).
                    <div className={'turn-actions' + (busy ? ' turn-actions--busy' : '')}>
                      {t.role === 'assistant' && (
                        <button
                          className="turn-btn"
                          title={copied === i ? `${UI.copy}됨` : UI.copy}
                          onClick={() => 복사하기(i, 표시본(t))}
                        >
                          {copied === i ? <Check size={16} /> : <Copy size={16} />}
                        </button>
                      )}
                      {t.id != null ? (
                        <>
                          {t.role === 'assistant' && (
                            <button className="turn-btn" title={UI.regen} onClick={() => 새로받기(i)} disabled={busy}>
                              <RotateCcw size={16} />
                            </button>
                          )}
                          {/* 교정 ↔ 복원 — 교정본이 없으면 '교정'(딥시크 호출), 있으면 보기 토글(원본↔교정본, 호출 없음) */}
                          {t.role === 'assistant' &&
                            (t.polished == null ? (
                              <button className="turn-btn" title={UI.polish} onClick={() => 교정하기(i)} disabled={busy}>
                                <Sparkles size={16} />
                              </button>
                            ) : t.polished_show ? (
                              <button className="turn-btn" title={UI.restore} onClick={() => 보기전환(i, false)} disabled={busy}>
                                <Undo2 size={16} />
                              </button>
                            ) : (
                              <button className="turn-btn" title={UI.polish} onClick={() => 보기전환(i, true)} disabled={busy}>
                                <Sparkles size={16} />
                              </button>
                            ))}
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
