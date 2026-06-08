import { useState, useEffect, Fragment, type ReactNode } from 'react';
import { 이미지를_썸네일로 } from './imageUtils';
import { alertAsk } from './dialog';
import { useCharacters, type Character, type Bond, type CharReport } from './useCharacters';
import { UI } from './strings';
import IconButton from './IconButton';
import Spinner from './Spinner';
import ImportDialog from './ImportDialog';
import FaceCrop from './FaceCrop';
import { nameDict } from './nameDict.generated';
import { splitAliases, firstName } from './nameUtils';
import Markdown from './Markdown';
import Dropdown from './Dropdown';
import { ImagePlus, Crop, Eraser, Flame, ArrowLeft, Bookmark, Pencil, X, MapPin, ChevronDown, UserPlus, Download, Trash2, RotateCcw } from 'lucide-react';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
  rectSortingStrategy,
  useSortable,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

const 빈인물 = (): Character => ({
  name: '',
  english_name: '',
  aliases: '',
  faction: '',
  appearance: '',
  personality: '',
  combat: '',
  notes: '',
  life_status: 'alive',
  is_active: true,
  thumbnail: '',
  avatar: '',
});

// 이미지가 없을 때 쓰는 기본 그림 (매핑: 히어로=아바타 그림 / 목록 썸네일=포트레이트 그림).
const HERO_PLACEHOLDER = '/assets/illust/avatar-placeholder.webp'; // 히어로(인물 카드)용
const LIST_PLACEHOLDER = '/assets/illust/portrait-placeholder.webp'; // 명부 목록 둥근 썸네일용

// 생사 상태 → 표시 라벨
const 상태label: Record<string, string> = { alive: '생존', deceased: '사망', unknown: '불명' };

// 생사 상태 → 초상/썸네일 효과 클래스 (사망=흑백, 불명=흑백+어둡게)
const statusFx = (s?: string) =>
  s === 'deceased' ? 'fx-dead' : s === 'unknown' ? 'fx-unknown' : '';

// 뷰 모드의 한 섹션(내용 있을 때만 호출).
function ViewSection({ label, text }: { label: string; text: string }) {
  return (
    <div className="view-section">
      <div className="view-label">{label}</div>
      <div className="view-text">
        <Markdown text={text} />
      </div>
    </div>
  );
}

// 인물 뷰 탭 (약력=현재 프로필, 나머지는 추후 채움)
const 인물탭 = ['약력', '보고서', '임무', '소지품', '서신'] as const;

// 아직 안 만든 탭의 빈 화면.
function EmptyTab() {
  return <p className="empty-tab dim">아직 펼쳐지지 않은 장입니다.</p>;
}

// 보고서 능력치 8종 (키→라벨). 서버 lib/report.mjs STAT_KEYS와 일치해야 한다.
const 능력치목록: [string, string][] = [
  ['prowess', '무력'],
  ['magic', '마력'],
  ['faith', '신앙'],
  ['intellect', '지성'],
  ['standing', '입지'],
  ['wealth', '재력'],
  ['charm', '매력'],
  ['resilience', '정신'],
];

// 능력치 한 줄(라벨·점수·막대·한 줄 평).
function StatBar({ label, value, comment }: { label: string; value: number; comment?: string }) {
  return (
    <div className="stat-row">
      <div className="stat-head">
        <span className="stat-label">{label}</span>
        {comment && <span className="stat-cmt">{comment}</span>}
        <span className="stat-num">{value}</span>
      </div>
      <span className="stat-track">
        <span className="stat-fill" style={{ width: `${value}%` }} />
      </span>
    </div>
  );
}

// 능력치 8종을 한눈에 — 팔각형 레이더 그래프(SVG, 의존성 없음).
function StatRadar({ stats }: { stats: Record<string, number> }) {
  const size = 240;
  const c = size / 2;
  const R = c - 30; // 라벨 자리 여백
  const n = 능력치목록.length; // 8
  const pt = (i: number, radius: number): [number, number] => {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / n; // 12시 방향부터 시계방향
    return [c + radius * Math.cos(a), c + radius * Math.sin(a)];
  };
  const poly = (radius: number | ((i: number) => number)) =>
    능력치목록
      .map((_, i) => pt(i, typeof radius === 'function' ? radius(i) : radius).join(','))
      .join(' ');
  const val = (i: number) => {
    const v = stats?.[능력치목록[i][0]] ?? 0;
    return (R * Math.max(0, Math.min(100, v))) / 100;
  };
  return (
    <svg className="stat-radar" viewBox={`0 0 ${size} ${size}`} role="img" aria-label="능력치 그래프">
      {[0.25, 0.5, 0.75, 1].map((f) => (
        <polygon key={f} className="radar-ring" points={poly(R * f)} />
      ))}
      {능력치목록.map((_, i) => {
        const [x, y] = pt(i, R);
        return <line key={i} className="radar-axis" x1={c} y1={c} x2={x} y2={y} />;
      })}
      <polygon className="radar-area" points={poly(val)} />
      {능력치목록.map(([, ko], i) => {
        const [x, y] = pt(i, R + 16);
        return (
          <text key={i} className="radar-label" x={x} y={y} textAnchor="middle" dominantBaseline="central">
            {ko}
          </text>
        );
      })}
    </svg>
  );
}

// 보고서 본문 렌더(발급본·골격 공용) — 2단: 왼쪽 능력치(인용구·해시태그·레이더·막대) / 오른쪽 분석.
function ReportBody({ report }: { report: CharReport }) {
  return (
    <div className="report-body">
      {report.quote && <p className="report-quote">{report.quote}</p>}
      {!!report.hashtags?.length && (
        <div className="report-tags">
          {report.hashtags.map((t, i) => (
            <span key={i} className="report-tag">
              #{t}
            </span>
          ))}
        </div>
      )}
      {/* 레이더 + 막대 그래프 (한 줄) */}
      <div className="report-stats-row">
        <StatRadar stats={report.stats ?? {}} />
        <div className="report-stats">
          {능력치목록.map(([k, ko]) => (
            <StatBar
              key={k}
              label={ko}
              value={report.stats?.[k] ?? 0}
              comment={report.stat_comments?.[k]}
            />
          ))}
        </div>
      </div>
      {/* 성격 분석 + 무의식 분석 (한 줄) */}
      <div className="report-analysis-row">
        {report.personality && <ViewSection label="행동 양상" text={report.personality} />}
        {report.unconscious && <ViewSection label="잠재 심리" text={report.unconscious} />}
      </div>
      {!!report.reputation?.length && (
        <div className="view-section">
          <div className="view-label">평판</div>
          <ul className="rep-list">
            {report.reputation.map((r, i) => (
              <li key={i} className="rep-item">
                <div className="rep-src">{r.source}</div>
                <div className="rep-cmt">{r.comment}</div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// 미발급/발급중 화면용 골격 — 흐릿하게 깔리므로 내용은 그저 그럴듯한 자리채움.
const 골격보고서: CharReport = {
  quote: '아직 거두지 못한 한마디',
  hashtags: ['미상', '미상', '미상', '미상', '미상'],
  stats: {
    prowess: 62,
    magic: 38,
    faith: 74,
    intellect: 56,
    standing: 80,
    wealth: 47,
    charm: 64,
    resilience: 33,
  },
  stat_comments: {
    prowess: '아직 가늠하지 못함',
    magic: '아직 가늠하지 못함',
    faith: '아직 가늠하지 못함',
    intellect: '아직 가늠하지 못함',
    standing: '아직 가늠하지 못함',
    wealth: '아직 가늠하지 못함',
    charm: '아직 가늠하지 못함',
    resilience: '아직 가늠하지 못함',
  },
  personality:
    '겉으로 드러나는 면모와 행동의 결이 이 자리에 적힌다. 분석관이 인물을 들여다보면 그 윤곽이 또렷이 떠오를 것이다.',
  unconscious:
    '본인도 미처 헤아리지 못한 내면의 동기와 오래된 상처가 이 자리에 새겨진다. 아직은 안개 너머에 잠들어 있다.',
  reputation: [
    { source: '아직 이름 없는 목소리', comment: '그분에 대해선 아직 할 말을 고르는 중이라네.' },
    { source: '아직 이름 없는 목소리', comment: '소문이 닿기엔 너무 먼 분이지.' },
    { source: '아직 이름 없는 목소리', comment: '글쎄, 무어라 말해야 할지.' },
    { source: '아직 이름 없는 목소리', comment: '곧 누군가 입을 열 테지.' },
    { source: '아직 이름 없는 목소리', comment: '판단은 잠시 미뤄두겠네.' },
    { source: '아직 이름 없는 사물', comment: '…….' },
  ],
};

// 보고서 탭 — 발급본이 있으면 그대로, 없으면(또는 발급 중) 골격을 흐리고 위에 안내·버튼.
function ReportView({
  report,
  reporting,
  err,
  onIssue,
}: {
  report?: CharReport | null;
  reporting: boolean;
  err: string | null;
  onIssue: () => void;
}) {
  // 첫 발급 중(보고서 없음) — 골격 흐리고 스피너로 '작동 중'.
  if (reporting && !report) {
    return (
      <div className="report-locked">
        <div className="report report--ghost" aria-hidden="true">
          <ReportBody report={골격보고서} />
        </div>
        <div className="report-lock-overlay">
          <Spinner label="분석관이 보고서를 작성하는 중…" />
        </div>
      </div>
    );
  }
  if (report) {
    return (
      <div className="report">
        <ReportBody report={report} />
        <div className="report-foot">
          <IconButton
            label={UI.regen}
            onClick={onIssue}
            disabled={reporting}
            className={reporting ? 'spinning' : ''}
          >
            <RotateCcw size={17} />
          </IconButton>
        </div>
        {err && <p className="report-err">{err}</p>}
      </div>
    );
  }
  // 미발급 — 골격 흐리고 위쪽에 안내·발급 버튼.
  return (
    <div className="report-locked">
      <div className="report report--ghost" aria-hidden="true">
        <ReportBody report={골격보고서} />
      </div>
      <div className="report-lock-overlay">
        <p className="report-lock-msg">아직 발급되지 않은 보고서입니다.</p>
        <button className="list-btn" onClick={onIssue}>
          분석 보고서 발급
        </button>
        {err && <p className="report-err">{err}</p>}
      </div>
    </div>
  );
}

// (괄호) 안 텍스트를 작고 연하게 — 약력 값의 부연 설명 톤. (Markdown 경량 렌더러와 동일 규칙)
function dimParens(text: string): ReactNode[] {
  return (text ?? '').split(/(\([^)]*\))/g).map((p, i) =>
    p.startsWith('(') && p.endsWith(')') ? (
      <span key={i} className="paren-dim">
        {p}
      </span>
    ) : (
      <Fragment key={i}>{p}</Fragment>
    ),
  );
}

// 신원 카드의 한 줄(라벨 + 값).
function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="info-row">
      <span className="info-row-label">{label}</span>
      <span className="info-row-value">{dimParens(value)}</span>
    </div>
  );
}

// 드래그로 정렬 가능한 목록 행.
// 드래그로 정렬 가능한 초상 카드(갤러리 한 칸).
function SortableCharCard({
  c,
  onOpen,
  onToggle,
}: {
  c: Character;
  onOpen: () => void;
  onToggle: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: c.id!,
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : undefined,
    zIndex: isDragging ? 2 : undefined,
  };
  const active = c.is_active !== false;
  const alias = splitAliases(c.aliases)[0] || '';
  return (
    <li
      ref={setNodeRef}
      style={style}
      className={'char-card' + (active ? '' : ' inactive')}
      onClick={onOpen}
      {...attributes}
      {...listeners}
    >
      <div className="char-card-img">
        <img
          className={statusFx(c.life_status)}
          src={c.thumbnail || c.avatar || HERO_PLACEHOLDER}
          alt=""
        />
        {c.life_status === 'unknown' && <span className="card-q">?</span>}
        <button
          className={'card-bm' + (active ? ' on' : '')}
          onClick={(e) => {
            e.stopPropagation();
            onToggle();
          }}
          onPointerDown={(e) => e.stopPropagation()}
          aria-label={active ? '등장 끄기' : '등장 켜기'}
        >
          <Bookmark size={15} fill={active ? 'currentColor' : 'none'} />
        </button>
        <div className="char-card-grad" />
        <div className="char-card-meta">
          <div className="char-card-name">{firstName(c.name)}</div>
          {alias && <div className="char-card-sub">{alias}</div>}
        </div>
      </div>
    </li>
  );
}

// 드래그로 정렬 가능한 인연(뷰) 행.
function SortableBond({
  id,
  avatar,
  fname,
  category,
  description,
}: {
  id: string;
  avatar: string;
  fname: string;
  category?: string;
  description?: string;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : undefined,
    zIndex: isDragging ? 2 : undefined,
  };
  return (
    <li ref={setNodeRef} style={style} className="bond-row" {...attributes} {...listeners}>
      <div className="bond-left">
        <img className="bond-av" src={avatar} alt="" />
        <div className="bond-id">
          <div className="bond-fname">{fname}</div>
          {category && <div className="bond-rel">{category}</div>}
        </div>
      </div>
      {description && <div className="bond-desc">{description}</div>}
    </li>
  );
}

export default function Characters({
  storyId,
  onClose,
}: {
  storyId: number | null;
  onClose: () => void;
}) {
  // 현재 이야기의 인물만 본다(이야기별 분리).
  const { chars, loading, dbReady, err, refresh } = useCharacters(storyId);
  const [viewing, setViewing] = useState<Character | null>(null); // 읽기 모드
  const [editing, setEditing] = useState<Character | null>(null); // 편집 모드
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const [cropping, setCropping] = useState(false); // 초상에서 얼굴 따기
  const [tab, setTab] = useState<string>('약력'); // 인물 뷰 탭
  const [bondsOpen, setBondsOpen] = useState(false); // 인연 카드 펼침/접힘(기본 접힘)
  const [reporting, setReporting] = useState(false); // 보고서 발급 중
  const [reportErr, setReportErr] = useState<string | null>(null);
  const [reportToast, setReportToast] = useState<string | null>(null); // 발급/갱신 알림
  const [armed, setArmed] = useState(false); // 삭제 두 번 누르기: 첫 클릭=활성, 둘째=실행
  useEffect(() => setArmed(false), [editing]); // 다른 인물로 옮기거나 닫으면 해제
  useEffect(() => {
    setTab('약력');
    setBondsOpen(false);
    setReportErr(null);
    setReportToast(null);
  }, [viewing?.id]); // 다른 인물(id 변경) 열 때만 약력·인연 접힘 초기화

  // 분석 보고서 발급(또는 새로고침/재작성) — Gemini Flash가 약력·맥락을 읽고 짓는다.
  async function 발급() {
    if (!viewing?.id || reporting) return;
    const 이전 = viewing.analysis ?? null; // 갱신 여부 판단용(이전 보고서)
    const 이름 = firstName(viewing.name);
    setReporting(true);
    setReportErr(null);
    setReportToast(null);
    try {
      const res = await fetch('/api/report', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ character_id: viewing.id, story_id: storyId }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        setReportErr(data.error || '발급에 실패했습니다.');
        return;
      }
      setViewing((v) => (v ? { ...v, analysis: data.report } : v));
      await refresh();
      // 발급/갱신 알림 — 내용이 실제로 바뀐 경우만(generated_at 제외 비교).
      const 알맹이 = (r: CharReport | null) => (r ? JSON.stringify({ ...r, generated_at: '' }) : '');
      if (!이전) setReportToast(`${이름}의 보고서가 발급되었습니다.`);
      else if (알맹이(이전) !== 알맹이(data.report))
        setReportToast(`${이름}의 보고서가 갱신되었습니다.`);
      window.setTimeout(() => setReportToast(null), 1000);
    } catch (e) {
      setReportErr((e as Error).message);
    } finally {
      setReporting(false);
    }
  }

  function set<K extends keyof Character>(k: K, v: Character[K]) {
    setEditing((prev) => (prev ? { ...prev, [k]: v } : prev));
  }

  async function onPickImage(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f || !editing) return;
    try {
      const thumb = await 이미지를_썸네일로(f); // 초상: 큰 히어로용(1400px)
      set('thumbnail', thumb);
    } catch (err) {
      await alertAsk({ message: '초상을 올리지 못했습니다.', detail: (err as Error).message });
    }
  }

  async function save() {
    if (!editing) return;
    if (!editing.name.trim()) {
      await alertAsk({ message: '성명은 꼭 필요합니다.' });
      return;
    }
    setSaving(true);
    try {
      const payload = { ...editing, story_id: storyId };
      if (payload.bonds) payload.bonds = payload.bonds.filter((b) => b.name?.trim());
      const res = await fetch('/api/characters', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ character: payload }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        await alertAsk({ message: `${UI.save}하지 못했습니다.`, detail: data.error || '알 수 없는 까닭' });
        return;
      }
      await refresh();
      setEditing(null);
      if (data.character) setViewing(data.character); // 저장 후 뷰로
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!editing) return;
    if (!editing.id) {
      setEditing(null);
      return;
    }
    const res = await fetch(`/api/characters?id=${editing.id}`, { method: 'DELETE' });
    const data = await res.json();
    if (!res.ok || data.error) {
      await alertAsk({ message: `${UI.erase}하지 못했습니다.`, detail: data.error || undefined });
      return;
    }
    await refresh();
    setEditing(null);
    setViewing(null); // 소각 후 목록으로
  }

  // 뷰모드에서 활성(등장) 토글 — 즉시 저장(낙관적 갱신)
  async function toggleActive() {
    if (!viewing) return;
    const prev = viewing;
    const updated = { ...viewing, is_active: viewing.is_active === false };
    setViewing(updated);
    try {
      await fetch('/api/characters', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ character: { ...updated, story_id: storyId } }),
      });
      await refresh();
    } catch {
      setViewing(prev); // 실패 시 되돌림
    }
  }

  // 목록에서 활성(등장) 토글 — 즉시 저장 후 새로고침
  async function toggleActiveOf(c: Character) {
    await fetch('/api/characters', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ character: { ...c, is_active: c.is_active === false, story_id: storyId } }),
    });
    await refresh();
  }

  // 드래그 정렬용 로컬 순서(서버 목록과 동기화) + 마우스·터치 센서
  const [items, setItems] = useState<Character[]>([]);
  useEffect(() => setItems(chars), [chars]);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
  );

  async function onDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIndex = items.findIndex((c) => c.id === active.id);
    const newIndex = items.findIndex((c) => c.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    const next = arrayMove(items, oldIndex, newIndex);
    setItems(next); // 낙관적 즉시 반영
    // 순서(sort_order)가 바뀐 항목만 저장
    const changed = next
      .map((c, i) => ({ c, i }))
      .filter(({ c, i }) => c.sort_order !== i);
    await Promise.all(
      changed.map(({ c, i }) =>
        fetch('/api/characters', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ character: { ...c, sort_order: i, story_id: storyId } }),
        }),
      ),
    );
    await refresh();
  }

  // 뷰에서 인연 순서 드래그 변경 — 즉시 저장
  async function onBondDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id || !viewing) return;
    const list = (viewing.bonds || []).filter((b) => b.name?.trim());
    const oldIndex = list.findIndex((b) => b.name === active.id);
    const newIndex = list.findIndex((b) => b.name === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    const next = arrayMove(list, oldIndex, newIndex);
    const updated = { ...viewing, bonds: next };
    setViewing(updated);
    await fetch('/api/characters', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ character: { ...updated, story_id: storyId } }),
    });
    await refresh();
  }

  // 인연 편집: 추가/수정/삭제
  function addBond() {
    set('bonds', [...(editing?.bonds || []), { name: '', category: '', description: '' }]);
  }
  function updateBond(i: number, patch: Partial<Bond>) {
    set(
      'bonds',
      (editing?.bonds || []).map((b, j) => (j === i ? { ...b, ...patch } : b)),
    );
  }
  function removeBond(i: number) {
    set(
      'bonds',
      (editing?.bonds || []).filter((_, j) => j !== i),
    );
  }

  // 인연 대상 이름 → 명부 인물(아바타 자동 연동용)
  const charByName = new Map(chars.map((c) => [c.name, c]));

  const viewMode = viewing && !editing; // 순수 읽기 모드

  return (
    <div className="modal-bg" onClick={onClose}>
      <div
        className={'modal has-hero' + (!editing && !viewing ? ' modal--list' : '')}
        onClick={(e) => e.stopPropagation()}
      >
        {/* 모바일 풀스크린: 노치/상태바 아래(안전영역) 차폐 — 스티키 탭 위로 콘텐츠 새는 것 방지 */}
        <div className="top-shield" />
        {/* 헤더·안내 — 뷰/편집 모드에선 히어로가 대신하므로 숨김(목록 모드 전용) */}
        {!viewMode && !editing && (
          <>
            <div className="modal-head">
              <h2>
                인물 명부
                {chars.length > 0 && <span className="head-count">{chars.length}</span>}
              </h2>
              <div className="head-actions">
                {chars.length > 0 && (
                  <>
                    <IconButton label="작성" active onClick={() => setEditing(빈인물())}>
                      <UserPlus size={17} />
                    </IconButton>
                    {storyId != null && (
                      <IconButton label={UI.import} onClick={() => setImporting(true)}>
                        <Download size={17} />
                      </IconButton>
                    )}
                  </>
                )}
                <IconButton label={UI.close} onClick={onClose}>
                  <X size={17} />
                </IconButton>
              </div>
            </div>

            {!dbReady && <p className="warn">아직 기록의 샘이 닿지 않아 인물을 기록할 수 없습니다.</p>}
            {dbReady && err && (
              <p className="warn">
                인물 표가 아직 없는 듯합니다. 안내된 SQL을 Supabase에서 한 번 실행하십시오.
                <br />
                <span className="dim">({err})</span>
              </p>
            )}
            {storyId == null && <p className="warn">먼저 운명의 장을 펼치십시오.</p>}
          </>
        )}

        {/* 뷰(읽기) 화면 */}
        {viewMode && viewing && (
          <div className="char-view">
            <div className="char-hero">
              <div className="char-hero-top">
                <IconButton label="목록으로" onClick={() => setViewing(null)}>
                  <ArrowLeft size={18} />
                </IconButton>
                <div className="hero-top-right">
                  <IconButton
                    label={viewing.is_active !== false ? '등장 끄기' : '등장 켜기'}
                    active={viewing.is_active !== false}
                    onClick={toggleActive}
                  >
                    <Bookmark size={18} fill={viewing.is_active !== false ? 'currentColor' : 'none'} />
                  </IconButton>
                  <IconButton label={UI.edit} onClick={() => setEditing(viewing)}>
                    <Pencil size={17} />
                  </IconButton>
                  <IconButton label={UI.close} onClick={onClose}>
                    <X size={18} />
                  </IconButton>
                </div>
              </div>
              <div className="char-hero-portrait">
                <img
                  className={statusFx(viewing.life_status)}
                  src={viewing.thumbnail || viewing.avatar || HERO_PLACEHOLDER}
                  alt=""
                />
                {viewing.life_status === 'unknown' && <span className="hero-q">?</span>}
              </div>
              <div className="char-hero-info">
                <div className="char-hero-name">
                  {viewing.name}
                  {viewing.life_status === 'deceased' && <span className="tag">사망</span>}
                  {viewing.life_status === 'unknown' && <span className="tag">불명</span>}
                </div>
                {viewing.english_name && <div className="char-hero-en">{viewing.english_name}</div>}
                {splitAliases(viewing.aliases).length > 0 && (
                  <div className="char-hero-chips">
                    {splitAliases(viewing.aliases).map((a, i) => (
                      <span key={i} className="vchip">
                        {a}
                      </span>
                    ))}
                  </div>
                )}
                {viewing.base && (
                  <div className="hero-base">
                    <MapPin className="hero-pin" size={13} />
                    {viewing.base}
                  </div>
                )}
              </div>
            </div>

            <div className="char-tabs">
              {인물탭.map((t) => (
                <button
                  key={t}
                  className={'char-tab' + (tab === t ? ' active' : '')}
                  onClick={() => setTab(t)}
                >
                  {t}
                </button>
              ))}
            </div>

            <div className="char-view-body">
              {tab === '약력' ? (
                <>
                  <div className="info-grid">
                    <div className="info-card">
                      <div className="info-card-title">신원</div>
                      {viewing.gender && <InfoRow label="성별" value={viewing.gender} />}
                      {viewing.faction && <InfoRow label="소속" value={viewing.faction} />}
                      {viewing.rank && <InfoRow label="신분" value={viewing.rank} />}
                      {viewing.crest && <InfoRow label="문장" value={viewing.crest} />}
                      <InfoRow label="상태" value={상태label[viewing.life_status || 'alive']} />
                    </div>
                    {(viewing.height ||
                      viewing.build ||
                      viewing.hair ||
                      viewing.iris ||
                      viewing.impression) && (
                      <div className="info-card">
                        <div className="info-card-title">용모</div>
                        {viewing.height && <InfoRow label="신장" value={viewing.height} />}
                        {viewing.build && <InfoRow label="체격" value={viewing.build} />}
                        {viewing.hair && <InfoRow label="모발" value={viewing.hair} />}
                        {viewing.iris && <InfoRow label="홍채" value={viewing.iris} />}
                        {viewing.impression && <InfoRow label="인상" value={viewing.impression} />}
                      </div>
                    )}
                  </div>
                  {viewing.personality && <ViewSection label="성향" text={viewing.personality} />}
                  {viewing.combat && <ViewSection label="전법" text={viewing.combat} />}
                  {viewing.notes && <ViewSection label="비고" text={viewing.notes} />}
                  {(viewing.bonds || []).some((b) => b.name?.trim()) && (
                    <div className="view-section">
                      <button className="bonds-head" onClick={() => setBondsOpen((o) => !o)}>
                        <span className="view-label">인연</span>
                        <ChevronDown size={18} className={'bonds-chev' + (bondsOpen ? ' open' : '')} />
                      </button>
                      <div className={'bonds-wrap' + (bondsOpen ? ' open' : '')}>
                        <div className="bonds-inner">
                        <DndContext
                          sensors={sensors}
                          collisionDetection={closestCenter}
                          onDragEnd={onBondDragEnd}
                        >
                        <SortableContext
                          items={(viewing.bonds || [])
                            .filter((b) => b.name?.trim())
                            .map((b) => b.name)}
                          strategy={verticalListSortingStrategy}
                        >
                          <ul className="bond-list">
                            {(viewing.bonds || [])
                              .filter((b) => b.name?.trim())
                              .map((b) => {
                                const t = charByName.get(b.name);
                                return (
                                  <SortableBond
                                    key={b.name}
                                    id={b.name}
                                    avatar={t?.avatar || t?.thumbnail || LIST_PLACEHOLDER}
                                    fname={firstName(b.name)}
                                    category={b.category}
                                    description={b.description}
                                  />
                                );
                              })}
                          </ul>
                        </SortableContext>
                      </DndContext>
                        </div>
                        </div>
                    </div>
                  )}
                  {viewing.is_active === false && (
                    <p className="dim small">현재 모습을 드러내지 않는 인물입니다.</p>
                  )}
                </>
              ) : tab === '보고서' ? (
                <ReportView
                  report={viewing.analysis}
                  reporting={reporting}
                  err={reportErr}
                  onIssue={발급}
                />
              ) : (
                <EmptyTab />
              )}
            </div>
            {reportToast && <div className="report-toast">{reportToast}</div>}
          </div>
        )}

        {/* 목록 화면 */}
        {!editing && !viewing && (
          <div className="modal-body">
            {loading ? (
              <Spinner />
            ) : chars.length === 0 ? (
              <div className="empty-state">
                <p className="empty-state-msg">아직 명부에 오른 이가 없습니다.</p>
                <button className="btn-accent" onClick={() => setEditing(빈인물())}>
                  첫 인물 등록
                </button>
                {storyId != null && (
                  <button className="btn-ghost" onClick={() => setImporting(true)}>
                    다른 장에서 {UI.import}
                  </button>
                )}
              </div>
            ) : (
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
                <SortableContext items={items.map((c) => c.id!)} strategy={rectSortingStrategy}>
                  <ul className="char-grid">
                    {items.map((c) => (
                      <SortableCharCard
                        key={c.id}
                        c={c}
                        onOpen={() => setViewing(c)}
                        onToggle={() => toggleActiveOf(c)}
                      />
                    ))}
                  </ul>
                </SortableContext>
              </DndContext>
            )}
          </div>
        )}

        {/* 편집 화면 — 뷰모드와 동일한 히어로+카드 레이아웃(입력형) */}
        {editing && (
          <div className="char-view char-edit">
            <div className="char-hero">
              <div className="char-hero-top">
                <IconButton label={UI.cancel} onClick={() => setEditing(null)}>
                  <ArrowLeft size={18} />
                </IconButton>
                <div className="hero-top-right">
                  <IconButton label={UI.close} onClick={onClose}>
                    <X size={18} />
                  </IconButton>
                </div>
              </div>
              <div className="char-hero-portrait">
                <img
                  className={statusFx(editing.life_status)}
                  src={editing.thumbnail || HERO_PLACEHOLDER}
                  alt=""
                />
                {editing.life_status === 'unknown' && <span className="hero-q">?</span>}
                <div className="portrait-tools">
                  <label className="ptool" data-tip="초상 등록">
                    <ImagePlus size={18} />
                    <input type="file" accept="image/*" onChange={onPickImage} hidden />
                  </label>
                  {editing.thumbnail && (
                    <button className="ptool" data-tip="초점 지정" onClick={() => setCropping(true)}>
                      <Crop size={18} />
                    </button>
                  )}
                  {editing.avatar && (
                    <button className="ptool" data-tip="초점 해제" onClick={() => set('avatar', '')}>
                      <Eraser size={18} />
                    </button>
                  )}
                  {editing.thumbnail && (
                    <button
                      className="ptool danger"
                      data-tip="초상 소각"
                      onClick={() => set('thumbnail', '')}
                    >
                      <Flame size={18} />
                    </button>
                  )}
                </div>
              </div>
              <div className="char-hero-info hero-edit-info">
                <label className="hero-field">
                  <span className="hero-lab">성명</span>
                  <input
                    className="hero-inp"
                    value={editing.name}
                    onChange={(e) => set('name', e.target.value)}
                    onBlur={() => {
                      const en = nameDict[editing.name.trim()];
                      if (en && !editing.english_name?.trim()) set('english_name', en);
                    }}
                  />
                </label>
                <label className="hero-field">
                  <span className="hero-lab">영문</span>
                  <input
                    className="hero-inp"
                    value={editing.english_name || ''}
                    onChange={(e) => set('english_name', e.target.value)}
                  />
                </label>
                <label className="hero-field">
                  <span className="hero-lab">이명</span>
                  <input
                    className="hero-inp"
                    value={editing.aliases || ''}
                    onChange={(e) => set('aliases', e.target.value)}
                  />
                </label>
                <label className="hero-field">
                  <span className="hero-lab">거점</span>
                  <input
                    className="hero-inp"
                    value={editing.base || ''}
                    onChange={(e) => set('base', e.target.value)}
                  />
                </label>
              </div>
            </div>

            <div className="char-view-body">
              <div className="info-grid">
                <div className="info-card">
                  <div className="info-card-title">신원</div>
                  <div className="edit-row">
                    <span className="edit-row-label">성별</span>
                    <Dropdown
                      value={editing.gender || ''}
                      options={[
                        { value: '남성', label: '남성' },
                        { value: '여성', label: '여성' },
                      ]}
                      onChange={(v) => set('gender', v)}
                      placeholder=""
                    />
                  </div>
                  <div className="edit-row">
                    <span className="edit-row-label">소속</span>
                    <input
                      className="edit-inp"
                      value={editing.faction || ''}
                      onChange={(e) => set('faction', e.target.value)}
                    />
                  </div>
                  <div className="edit-row">
                    <span className="edit-row-label">신분</span>
                    <input
                      className="edit-inp"
                      value={editing.rank || ''}
                      onChange={(e) => set('rank', e.target.value)}
                    />
                  </div>
                  <div className="edit-row">
                    <span className="edit-row-label">문장</span>
                    <input
                      className="edit-inp"
                      value={editing.crest || ''}
                      onChange={(e) => set('crest', e.target.value)}
                    />
                  </div>
                  <div className="edit-row">
                    <span className="edit-row-label">상태</span>
                    <Dropdown
                      value={editing.life_status || 'alive'}
                      options={[
                        { value: 'alive', label: '생존' },
                        { value: 'deceased', label: '사망' },
                        { value: 'unknown', label: '불명' },
                      ]}
                      onChange={(v) => set('life_status', v as Character['life_status'])}
                    />
                  </div>
                </div>
                <div className="info-card">
                  <div className="info-card-title">용모</div>
                  <div className="edit-row">
                    <span className="edit-row-label">신장</span>
                    <input
                      className="edit-inp"
                      value={editing.height || ''}
                      onChange={(e) => set('height', e.target.value)}
                    />
                  </div>
                  <div className="edit-row">
                    <span className="edit-row-label">체격</span>
                    <input
                      className="edit-inp"
                      value={editing.build || ''}
                      onChange={(e) => set('build', e.target.value)}
                    />
                  </div>
                  <div className="edit-row">
                    <span className="edit-row-label">모발</span>
                    <input
                      className="edit-inp"
                      value={editing.hair || ''}
                      onChange={(e) => set('hair', e.target.value)}
                    />
                  </div>
                  <div className="edit-row">
                    <span className="edit-row-label">홍채</span>
                    <input
                      className="edit-inp"
                      value={editing.iris || ''}
                      onChange={(e) => set('iris', e.target.value)}
                    />
                  </div>
                  <div className="edit-row">
                    <span className="edit-row-label">인상</span>
                    <input
                      className="edit-inp"
                      value={editing.impression || ''}
                      onChange={(e) => set('impression', e.target.value)}
                    />
                  </div>
                </div>
              </div>

              <div className="view-section">
                <div className="view-label">성향</div>
                <textarea
                  className="edit-area"
                  rows={4}
                  value={editing.personality || ''}
                  onChange={(e) => set('personality', e.target.value)}
                />
              </div>
              <div className="view-section">
                <div className="view-label">전법</div>
                <textarea
                  className="edit-area"
                  rows={3}
                  value={editing.combat || ''}
                  onChange={(e) => set('combat', e.target.value)}
                />
              </div>
              <div className="view-section">
                <div className="view-label">비고</div>
                <textarea
                  className="edit-area"
                  rows={3}
                  value={editing.notes || ''}
                  onChange={(e) => set('notes', e.target.value)}
                />
              </div>

              <div className="view-section">
                <div className="view-label">인연</div>
                {(editing.bonds || []).map((b, i) => (
                  <div className="bond-edit" key={i}>
                    <div className="bond-edit-top">
                      <label className="bond-f">
                        <span className="bond-flab">성명</span>
                        <input
                          className="edit-inp"
                          value={b.name}
                          onChange={(e) => updateBond(i, { name: e.target.value })}
                        />
                      </label>
                      <button className="bond-del" onClick={() => removeBond(i)} aria-label={UI.erase}>
                        <X size={16} />
                      </button>
                    </div>
                    <div className="bond-edit-row2">
                      <label className="bond-f">
                        <span className="bond-flab">관계</span>
                        <input
                          className="edit-inp"
                          value={b.category || ''}
                          onChange={(e) => updateBond(i, { category: e.target.value })}
                        />
                      </label>
                      <label className="bond-f">
                        <span className="bond-flab">상태</span>
                        <Dropdown
                          value={b.status || 'alive'}
                          options={[
                            { value: 'alive', label: '생존' },
                            { value: 'deceased', label: '사망' },
                            { value: 'unknown', label: '불명' },
                          ]}
                          onChange={(v) => updateBond(i, { status: v as Bond['status'] })}
                        />
                      </label>
                    </div>
                    <label className="bond-f">
                      <span className="bond-flab">설명</span>
                      <textarea
                        className="edit-area"
                        rows={2}
                        value={b.description || ''}
                        onChange={(e) => updateBond(i, { description: e.target.value })}
                      />
                    </label>
                  </div>
                ))}
                <button className="list-btn bond-add" onClick={addBond}>
                  ＋ 인연 추가
                </button>
              </div>

              <div className="editor-actions">
                {editing.id && (
                  <button
                    className={'btn-erase' + (armed ? ' armed' : '')}
                    onClick={() => (armed ? remove() : setArmed(true))}
                    title={UI.erase}
                    aria-label={UI.erase}
                  >
                    <Trash2 size={18} />
                  </button>
                )}
                <div className="editor-actions-end">
                  <button onClick={() => setEditing(null)}>{UI.cancel}</button>
                  <button className="primary" onClick={save} disabled={saving}>
                    {saving ? <span className="spinner" /> : UI.save}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {cropping && editing?.thumbnail && (
          <FaceCrop
            src={editing.thumbnail}
            onDone={(url) => {
              set('avatar', url);
              setCropping(false);
            }}
            onCancel={() => setCropping(false)}
          />
        )}

        {importing && storyId != null && (
          <ImportDialog<Character>
            title={`명부 ${UI.import}`}
            endpoint="/api/characters"
            itemsKey="characters"
            payloadKey="character"
            currentStoryId={storyId}
            labelOf={(c) => c.name}
            subOf={(c) => splitAliases(c.aliases)[0] || c.faction || undefined}
            imageOf={(c) => c.avatar || c.thumbnail || LIST_PLACEHOLDER}
            fxOf={(c) => statusFx(c.life_status)}
            omit={['analysis', 'is_active', 'sort_order']}
            onClose={() => setImporting(false)}
            onDone={refresh}
          />
        )}
      </div>
    </div>
  );
}
