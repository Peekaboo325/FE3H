import { useState, useEffect } from 'react';
import { useLore, type Lore, type LoreSection } from './useLore';
import { alertAsk } from './dialog';
import ImportDialog from './ImportDialog';
import {
  X,
  Trash2,
  BookPlus,
  Download,
  ChevronRight,
  ArrowLeft,
  Pencil,
  Bookmark,
  GripVertical,
  Plus,
} from 'lucide-react';
import { UI } from './strings';
import IconButton from './IconButton';
import Spinner from './Spinner';
import Dropdown from './Dropdown';
import Markdown from './Markdown';
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
  useSortable,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

// 대륙 문헌의 다섯 영역(닫힌 목록). 분류(category) 칸에 이 제목을 그대로 담아 갈래를 가른다.
const TOPICS = [
  { title: '세력 · 가문', sub: '대륙을 움직이는 세력과 혈통', img: '/assets/illust/lore-faction.webp' },
  { title: '지역 · 지리', sub: '대륙의 형세와 도시 및 건축의 기록', img: '/assets/illust/lore-region.webp' },
  { title: '역사 · 사건', sub: '시대를 가른 선택과 사건의 기록', img: '/assets/illust/lore-history.webp' },
  { title: '제도 · 문화', sub: '사람들을 묶는 법도와 삶의 관습', img: '/assets/illust/lore-culture.webp' },
  { title: '문장 · 유산', sub: '피에 깃든 문장과 영웅의 유산', img: '/assets/illust/lore-crest.webp' },
];
const TOPIC_TITLES = TOPICS.map((t) => t.title);
const ORPHAN = ' 미분류'; // 다섯 영역과 안 맞는 옛 분류를 모으는 자리(센티넬)

const 빈설정 = (category = ''): Lore => ({ title: '', category, sections: [], body: '', is_active: true });

// 편찬용 소주제 — 드래그 정렬을 위해 안정 키(id)를 단다(저장 시 떼어냄).
type Sec = { id: string; subtitle: string; content: string };
let _sid = 0;
const uid = () => `s${Date.now().toString(36)}${(_sid++).toString(36)}`;

// 문헌 → 편찬용 소주제 배열. 옛 문헌(섹션 없음)은 body를 한 소주제로 끌어와 자연히 이주.
function secsFrom(e: Lore): Sec[] {
  const src: LoreSection[] = e.sections?.length
    ? e.sections
    : e.body
      ? [{ subtitle: '', content: e.body }]
      : [];
  const arr = src.map((s) => ({ id: uid(), subtitle: s.subtitle || '', content: s.content || '' }));
  return arr.length ? arr : [{ id: uid(), subtitle: '', content: '' }];
}

// 소주제 → body 평문 거울(주입·검색이 읽는 단일 출처).
function sectionsToText(secs: LoreSection[]): string {
  return secs
    .map((s) => (s.subtitle.trim() ? `${s.subtitle.trim()}\n` : '') + (s.content || '').trim())
    .filter((t) => t.trim())
    .join('\n\n')
    .trim();
}

// 목록·뷰의 한 줄 목차 — 소주제 제목들을 ' · '로.
const tocOf = (e: Lore) =>
  (e.sections || [])
    .map((s) => s.subtitle)
    .filter(Boolean)
    .join(' · ');

// ── 편찬: 소주제 한 칸(드래그 정렬) ────────────────────────────────────────
function SortableSec({
  sec,
  canRemove,
  onUpdate,
  onRemove,
}: {
  sec: Sec;
  canRemove: boolean;
  onUpdate: (id: string, k: 'subtitle' | 'content', v: string) => void;
  onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: sec.id,
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : undefined,
    zIndex: isDragging ? 2 : undefined,
  };
  return (
    <div ref={setNodeRef} style={style} className="lore-sec">
      <div className="lore-sec-head">
        {/* 끌기는 손잡이로만 — 본문 텍스트 선택을 방해하지 않게 */}
        <button className="lore-sec-grip" {...attributes} {...listeners} aria-label="끌어 옮기기">
          <GripVertical size={16} />
        </button>
        <input
          className="lore-sec-sub"
          value={sec.subtitle}
          onChange={(e) => onUpdate(sec.id, 'subtitle', e.target.value)}
          placeholder="소주제 제목 (예: 군제와 기사단)"
        />
        {canRemove && (
          <button className="lore-sec-del" onClick={onRemove} title={UI.erase} aria-label={UI.erase}>
            <X size={15} />
          </button>
        )}
      </div>
      <textarea
        className="lore-sec-body"
        rows={5}
        value={sec.content}
        onChange={(e) => onUpdate(sec.id, 'content', e.target.value)}
        placeholder="내용을 적으십시오…"
      />
    </div>
  );
}

export default function LorePanel({
  storyId,
  onClose,
}: {
  storyId: number | null;
  onClose: () => void;
}) {
  const { entries, loading, dbReady, err, refresh } = useLore(storyId);
  const [topic, setTopic] = useState<string | null>(null); // null = 영역 배너 첫 화면
  const [viewing, setViewing] = useState<Lore | null>(null); // 읽기(뷰) 모드
  const [editing, setEditing] = useState<Lore | null>(null); // 편찬(편집) 모드
  const [secs, setSecs] = useState<Sec[]>([]); // 편찬 중인 소주제(독립 상태)
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const [armed, setArmed] = useState(false); // 소각 두 번 누르기: 첫 클릭=활성, 둘째=실행
  useEffect(() => setArmed(false), [editing]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
  );

  function set<K extends keyof Lore>(k: K, v: Lore[K]) {
    setEditing((prev) => (prev ? { ...prev, [k]: v } : prev));
  }

  // 편찬 진입 — 소주제 상태도 같이 세팅(편집 객체 정체성과 무관하게)
  const openEdit = (e: Lore) => {
    setSecs(secsFrom(e));
    setEditing(e);
  };
  const openNew = (category: string) => {
    const e = 빈설정(category);
    setSecs(secsFrom(e));
    setEditing(e);
  };

  const addSec = () => setSecs((p) => [...p, { id: uid(), subtitle: '', content: '' }]);
  const removeSec = (id: string) =>
    setSecs((p) => (p.length <= 1 ? p : p.filter((s) => s.id !== id)));
  const updateSec = (id: string, k: 'subtitle' | 'content', v: string) =>
    setSecs((p) => p.map((s) => (s.id === id ? { ...s, [k]: v } : s)));
  const onSecDragEnd = (ev: DragEndEvent) => {
    const { active, over } = ev;
    if (!over || active.id === over.id) return;
    setSecs((p) => {
      const oldI = p.findIndex((s) => s.id === active.id);
      const newI = p.findIndex((s) => s.id === over.id);
      return oldI < 0 || newI < 0 ? p : arrayMove(p, oldI, newI);
    });
  };

  // 이 문헌이 topic(영역)에 속하는지 — '미분류'는 다섯 영역 어디에도 안 든 것
  const belongs = (e: Lore) =>
    topic === ORPHAN ? !TOPIC_TITLES.includes(e.category || '') : e.category === topic;
  const inTopic = entries.filter(belongs);
  const orphans = entries.filter((e) => !TOPIC_TITLES.includes(e.category || ''));
  const viewNo = viewing ? entries.findIndex((e) => e.id === viewing.id) + 1 : 0;

  async function save() {
    if (!editing) return;
    if (!editing.title.trim()) {
      await alertAsk({ message: '갈래(이름)는 꼭 필요합니다.' });
      return;
    }
    if (!editing.category) {
      await alertAsk({ message: '영역을 골라 주십시오.' });
      return;
    }
    const cleanSecs: LoreSection[] = secs
      .map((s) => ({ subtitle: s.subtitle.trim(), content: s.content }))
      .filter((s) => s.subtitle || (s.content || '').trim());
    const merged: Lore = { ...editing, sections: cleanSecs, body: sectionsToText(cleanSecs) };
    setSaving(true);
    try {
      const res = await fetch('/api/lore', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ entry: { ...merged, story_id: storyId } }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        await alertAsk({ message: `${UI.save}하지 못했습니다.`, detail: data.error || '알 수 없는 까닭' });
        return;
      }
      await refresh();
      setTopic(merged.category!);
      setViewing(merged.id ? merged : null); // 편찬 후엔 그 문헌 뷰로, 새 문헌은 목록으로
      setEditing(null);
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
    const res = await fetch(`/api/lore?id=${editing.id}`, { method: 'DELETE' });
    const data = await res.json();
    if (!res.ok || data.error) {
      await alertAsk({ message: `${UI.erase}하지 못했습니다.`, detail: data.error || undefined });
      return;
    }
    await refresh();
    setEditing(null);
    setViewing(null);
  }

  // 활성(반영) 토글 — 인물 명부 방식.
  async function toggleActive() {
    if (!viewing) return;
    const prev = viewing;
    const updated = { ...viewing, is_active: viewing.is_active === false };
    setViewing(updated);
    try {
      await fetch('/api/lore', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ entry: { ...updated, story_id: storyId } }),
      });
      await refresh();
    } catch {
      setViewing(prev);
    }
  }
  async function toggleActiveOf(e: Lore) {
    await fetch('/api/lore', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ entry: { ...e, is_active: e.is_active === false, story_id: storyId } }),
    });
    await refresh();
  }

  // 화면 단계: 편찬 > 뷰 > 갈래 목록 > 영역 배너
  const mode = editing ? 'edit' : viewing ? 'view' : topic ? 'list' : 'index';
  const headTitle = editing
    ? editing.id
      ? `문헌 ${UI.compile}`
      : '새 문헌'
    : viewing
      ? viewing.title
      : topic
        ? topic === ORPHAN
          ? '미분류'
          : topic
        : '대륙 문헌';

  return (
    <div className="modal-bg" onClick={onClose}>
      <div
        className={'modal has-hero modal--lore' + (!editing ? ' modal--list' : '')}
        onClick={(e) => e.stopPropagation()}
      >
        {/* 모바일 풀스크린: 노치/상태바 아래(안전영역) 차폐 */}
        <div className="top-shield" />
        <div className="modal-head">
          <div className="head-left">
            {mode === 'view' && (
              <IconButton label="갈래로" onClick={() => setViewing(null)}>
                <ArrowLeft size={18} />
              </IconButton>
            )}
            {mode === 'list' && (
              <IconButton label="영역으로" onClick={() => setTopic(null)}>
                <ArrowLeft size={18} />
              </IconButton>
            )}
            <h2>
              {headTitle}
              {mode === 'list' && inTopic.length > 0 && (
                <span className="head-count">{inTopic.length}</span>
              )}
            </h2>
          </div>
          <div className="head-actions">
            {mode === 'list' && topic !== ORPHAN && (
              <IconButton label="작성" active onClick={() => openNew(topic!)}>
                <BookPlus size={17} />
              </IconButton>
            )}
            {mode === 'view' && viewing && (
              <>
                <IconButton
                  label={viewing.is_active !== false ? '잠재우기' : '깨우기'}
                  active={viewing.is_active !== false}
                  onClick={toggleActive}
                >
                  <Bookmark size={18} fill={viewing.is_active !== false ? 'currentColor' : 'none'} />
                </IconButton>
                <IconButton label={UI.compile} onClick={() => openEdit(viewing)}>
                  <Pencil size={17} />
                </IconButton>
              </>
            )}
            {mode === 'index' && storyId != null && (
              <IconButton label={UI.import} onClick={() => setImporting(true)}>
                <Download size={17} />
              </IconButton>
            )}
            <IconButton label={UI.close} onClick={onClose}>
              <X size={17} />
            </IconButton>
          </div>
        </div>

        {!dbReady && (
          <p className="warn">아직 기록의 샘이 닿지 않아 문헌을 기록할 수 없습니다.</p>
        )}
        {dbReady && err && (
          <p className="warn">
            문헌 표가 아직 없는 듯합니다. 안내된 SQL을 Supabase에서 한 번 실행하십시오.
            <br />
            <span className="dim">({err})</span>
          </p>
        )}
        {storyId == null && <p className="warn">먼저 운명의 장을 펼치십시오.</p>}

        {/* 첫 화면 — 다섯 영역 배너 */}
        {mode === 'index' && (
          <div className="modal-body">
            <ul className="list-rows lore-topics">
              {TOPICS.map((t) => {
                const n = entries.filter((e) => e.category === t.title).length;
                return (
                  <li key={t.title} className="list-row" onClick={() => setTopic(t.title)}>
                    <img
                      className="list-row-img"
                      src={t.img}
                      alt=""
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                      }}
                    />
                    <div className="list-row-meta">
                      <div className="list-row-name">{t.title}</div>
                      <div className="list-row-sub">{t.sub}</div>
                    </div>
                    <span className="list-row-right lore-right">
                      {n > 0 && <span className="lore-count">{n}권</span>}
                      <ChevronRight size={16} />
                    </span>
                  </li>
                );
              })}
              {orphans.length > 0 && (
                <li
                  className="list-row list-row--plain lore-orphan"
                  onClick={() => setTopic(ORPHAN)}
                >
                  <div className="list-row-meta">
                    <div className="list-row-name">미분류 문헌</div>
                    <div className="list-row-sub">영역을 다시 정해 주십시오</div>
                  </div>
                  <span className="list-row-right lore-right">
                    <span className="lore-count">{orphans.length}권</span>
                    <ChevronRight size={16} />
                  </span>
                </li>
              )}
            </ul>
          </div>
        )}

        {/* 갈래 화면 — 그 영역의 문헌 목록 */}
        {mode === 'list' && (
          <div className="modal-body">
            {loading ? (
              <Spinner />
            ) : inTopic.length === 0 ? (
              <div className="empty-state">
                <p className="empty-state-msg">이 영역엔 아직 문헌이 없습니다.</p>
                {topic !== ORPHAN && (
                  <button className="btn-accent" onClick={() => openNew(topic!)}>
                    첫 문헌 기록
                  </button>
                )}
              </div>
            ) : (
              <ul className="char-list">
                {entries.map((e, i) =>
                  belongs(e) ? (
                    <li
                      key={e.id}
                      className={'char-row' + (e.is_active === false ? ' inactive' : '')}
                    >
                      <div className="char-meta clickable" onClick={() => setViewing(e)}>
                        <div className="char-name">
                          <span className="ep-no jang">제{i + 1}권</span>
                          {e.title}
                        </div>
                        <div className="char-sub">{tocOf(e) || (e.body || '').slice(0, 40)}</div>
                      </div>
                      <button
                        className={'row-bm' + (e.is_active !== false ? ' on' : '')}
                        onClick={(ev) => {
                          ev.stopPropagation();
                          toggleActiveOf(e);
                        }}
                        title={e.is_active !== false ? '잠재우기' : '깨우기'}
                        aria-label={e.is_active !== false ? '잠재우기' : '깨우기'}
                      >
                        <Bookmark size={18} fill={e.is_active !== false ? 'currentColor' : 'none'} />
                      </button>
                    </li>
                  ) : null,
                )}
              </ul>
            )}
          </div>
        )}

        {/* 뷰(읽기) 화면 */}
        {mode === 'view' && viewing && (
          <div className="modal-body lore-view">
            <div className="lore-view-top">
              {viewNo > 0 && <span className="ep-no jang">제{viewNo}권</span>}
              {viewing.category && <span className="tag">{viewing.category}</span>}
            </div>
            {tocOf(viewing) && <p className="lore-toc">{tocOf(viewing)}</p>}
            <div className="lore-view-body">
              {viewing.sections?.length ? (
                viewing.sections.map((s, i) => (
                  <section key={i} className="lore-view-sec">
                    {s.subtitle && <h3 className="lore-view-subtitle">{s.subtitle}</h3>}
                    {s.content?.trim() && <Markdown text={s.content} />}
                  </section>
                ))
              ) : viewing.body?.trim() ? (
                <Markdown text={viewing.body} />
              ) : (
                <p className="dim small">아직 적힌 내용이 없습니다.</p>
              )}
            </div>
          </div>
        )}

        {/* 편찬(편집) 화면 */}
        {mode === 'edit' && editing && (
          <div className="modal-body editor">
            {/* 영역(좁게·좌) · 갈래(넓게·우) */}
            <div className="row2 lore-fields">
              <label className="lore-f-area">
                영역 *
                <Dropdown
                  value={editing.category || ''}
                  options={TOPICS.map((t) => ({ value: t.title, label: t.title }))}
                  onChange={(v) => set('category', v)}
                  placeholder="영역을 고르십시오."
                />
              </label>
              <label className="lore-f-title">
                갈래 *
                <input
                  value={editing.title}
                  onChange={(e) => set('title', e.target.value)}
                  placeholder="예: 퍼거스 신성 왕국"
                />
              </label>
            </div>

            {/* 내용 — 소주제 여러 칸(드래그 정렬) */}
            <div className="lore-secs-wrap">
              <span className="lore-secs-label">내용 — 소주제</span>
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onSecDragEnd}>
                <SortableContext items={secs.map((s) => s.id)} strategy={verticalListSortingStrategy}>
                  <div className="lore-secs">
                    {secs.map((s) => (
                      <SortableSec
                        key={s.id}
                        sec={s}
                        canRemove={secs.length > 1}
                        onUpdate={updateSec}
                        onRemove={() => removeSec(s.id)}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
              <button className="lore-add-sec" onClick={addSec}>
                <Plus size={15} />
                소주제 추가
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
                  {saving ? `${UI.save}하는 중…` : UI.save}
                </button>
              </div>
            </div>
          </div>
        )}

        {importing && storyId != null && (
          <ImportDialog<Lore>
            title={`문헌 ${UI.import}`}
            endpoint="/api/lore"
            itemsKey="lore"
            payloadKey="entry"
            currentStoryId={storyId}
            labelOf={(e) => e.title}
            subOf={(e) => e.category || undefined}
            onClose={() => setImporting(false)}
            onDone={refresh}
          />
        )}
      </div>
    </div>
  );
}
