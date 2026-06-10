import { useState, useEffect } from 'react';
import { useLore, type Lore, type LoreSection } from './useLore';
import { alertAsk } from './dialog';
import ImportDialog from './ImportDialog';
import {
  X,
  Trash2,
  Download,
  ChevronRight,
  ChevronLeft,
  ArrowLeft,
  Pencil,
  Bookmark,
  GripVertical,
  Plus,
  Feather,
  BookOpen,
} from 'lucide-react';
import { UI } from './strings';
import IconButton from './IconButton';
import Button from './Button';
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
// ⚠️ 일러스트는 옛 주제 분류 시절 그림을 임시로 걸어둠 — 새 그림(영역별 문장) 반입 시 교체.
const TOPICS = [
  { title: '제국', sub: '남녘을 다스리는 검은 독수리의 제위', img: '/assets/illust/lore-faction.webp' },
  { title: '왕국', sub: '북녘 기사들의 신앙과 충의', img: '/assets/illust/lore-region.webp' },
  { title: '동맹', sub: '동녘 제후들의 원탁과 책략', img: '/assets/illust/lore-culture.webp' },
  { title: '교단', sub: '여신의 가르침과 세이로스의 위계', img: '/assets/illust/lore-crest.webp' },
  { title: '만상', sub: '어느 깃발에도 매이지 않는 만물의 기록', img: '/assets/illust/lore-history.webp' },
];
const TOPIC_TITLES = TOPICS.map((t) => t.title);
const ORPHAN = ' 미분류'; // 다섯 영역과 안 맞는 옛 분류를 모으는 자리(센티넬)

const 빈설정 = (category = ''): Lore => ({ title: '', category, sections: [], body: '', is_active: true });

// 편찬용 항목 — 드래그 정렬을 위해 안정 키(id)를 단다(저장 시 떼어냄).
type Sec = { id: string; subtitle: string; content: string };
let _sid = 0;
const uid = () => `s${Date.now().toString(36)}${(_sid++).toString(36)}`;

function secsFrom(e: Lore): Sec[] {
  const src: LoreSection[] = e.sections?.length
    ? e.sections
    : e.body
      ? [{ subtitle: '', content: e.body }]
      : [];
  const arr = src.map((s) => ({ id: uid(), subtitle: s.subtitle || '', content: s.content || '' }));
  return arr.length ? arr : [{ id: uid(), subtitle: '', content: '' }];
}

function sectionsToText(secs: LoreSection[]): string {
  return secs
    .map((s) => (s.subtitle.trim() ? `${s.subtitle.trim()}\n` : '') + (s.content || '').trim())
    .filter((t) => t.trim())
    .join('\n\n')
    .trim();
}

const tocOf = (e: Lore) =>
  (e.sections || [])
    .map((s) => s.subtitle)
    .filter(Boolean)
    .join(' · ');

// ── 편찬: 항목 한 칸(드래그 정렬) ──────────────────────────────────────────
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
        <button className="lore-sec-grip" {...attributes} {...listeners} aria-label="끌어 옮기기">
          <GripVertical size={16} />
        </button>
        <input
          className="lore-sec-sub"
          value={sec.subtitle}
          onChange={(e) => onUpdate(sec.id, 'subtitle', e.target.value)}
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
      />
    </div>
  );
}

// ── 목차 사이드바: 문헌 한 권(드래그 정렬) ────────────────────────────────
function SortableVol({
  e,
  no,
  sel,
  onView,
  onToggle,
}: {
  e: Lore;
  no: number;
  sel: boolean;
  onView: () => void;
  onToggle: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: e.id!,
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : undefined,
    zIndex: isDragging ? 2 : undefined,
  };
  const active = e.is_active !== false;
  return (
    <li
      ref={setNodeRef}
      style={style}
      className={'lore-vol' + (sel ? ' sel' : '') + (active ? '' : ' inactive')}
      {...attributes}
      {...listeners}
    >
      <div className="lore-vol-meta" onClick={onView}>
        <span className="lore-vol-no">제{no}권</span>
        <div className="lore-vol-title">{e.title}</div>
        {tocOf(e) && <div className="lore-vol-toc">{tocOf(e)}</div>}
      </div>
      <button
        className={'row-bm' + (active ? ' on' : '')}
        onClick={(ev) => {
          ev.stopPropagation();
          onToggle();
        }}
        onPointerDown={(ev) => ev.stopPropagation()}
        title={active ? '잠재우기' : '깨우기'}
        aria-label={active ? '잠재우기' : '깨우기'}
      >
        <Bookmark size={17} fill={active ? 'currentColor' : 'none'} />
      </button>
    </li>
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
  const [viewing, setViewing] = useState<Lore | null>(null); // 우측 본문에 펼친 문헌
  const [editing, setEditing] = useState<Lore | null>(null); // 편찬(편집) 모드
  const [secs, setSecs] = useState<Sec[]>([]);
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const [armed, setArmed] = useState(false);
  useEffect(() => setArmed(false), [editing]);
  // 목차 드래그 정렬용 로컬 순서(서버 목록과 동기화)
  const [items, setItems] = useState<Lore[]>([]);
  useEffect(() => setItems(entries), [entries]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
  );

  function set<K extends keyof Lore>(k: K, v: Lore[K]) {
    setEditing((prev) => (prev ? { ...prev, [k]: v } : prev));
  }

  const openEdit = (e: Lore) => {
    setSecs(secsFrom(e));
    setEditing(e);
  };
  const openNew = (category: string) => {
    const e = 빈설정(category);
    setSecs(secsFrom(e));
    setViewing(null);
    setEditing(e);
  };
  const backToVols = () => {
    setViewing(null);
    setEditing(null);
  };
  const backToTopics = () => {
    setViewing(null);
    setEditing(null);
    setTopic(null);
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

  const belongs = (e: Lore) =>
    topic === ORPHAN ? !TOPIC_TITLES.includes(e.category || '') : e.category === topic;
  const inTopic = entries.filter(belongs);
  const localInTopic = items.filter(belongs); // 드래그 중 즉시 반영용(영역 안 순서)
  const orphans = entries.filter((e) => !TOPIC_TITLES.includes(e.category || ''));
  // 제N권 = 그 영역 안에서의 순번(앵커 '세력 제N권'과 일치)
  const volNo = (e: Lore) => inTopic.findIndex((x) => x.id === e.id) + 1;

  // 목차 드래그 정렬 — 영역 안에서만 순서를 바꾸고, 전체 sort_order 정합은 유지한다.
  async function onVolDragEnd(ev: DragEndEvent) {
    const { active, over } = ev;
    if (!over || active.id === over.id) return;
    const sub = items.filter(belongs);
    const oldI = sub.findIndex((x) => x.id === active.id);
    const newI = sub.findIndex((x) => x.id === over.id);
    if (oldI < 0 || newI < 0) return;
    const newSub = arrayMove(sub, oldI, newI);
    let k = 0;
    const nextFull = items.map((x) => (belongs(x) ? newSub[k++] : x)); // 영역 자리에 새 순서를 끼워 전체 재구성
    setItems(nextFull); // 낙관적 즉시 반영
    // 전체 인덱스를 sort_order로 — 바뀐 것만 저장(다른 영역 상대순서는 보존)
    const changed = nextFull.map((x, i) => ({ x, i })).filter(({ x, i }) => x.sort_order !== i);
    await Promise.all(
      changed.map(({ x, i }) =>
        fetch('/api/lore', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ entry: { ...x, sort_order: i, story_id: storyId } }),
        }),
      ),
    );
    await refresh();
  }

  // 이전/다음 권(현재 영역 안에서)
  const vIdx = viewing ? inTopic.findIndex((e) => e.id === viewing.id) : -1;
  const prevE = vIdx > 0 ? inTopic[vIdx - 1] : null;
  const nextE = vIdx >= 0 && vIdx < inTopic.length - 1 ? inTopic[vIdx + 1] : null;

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
      const saved: Lore = data.entry || merged;
      setTopic(saved.category || merged.category!);
      setViewing(saved); // 기록한 문헌을 우측에 펼침
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

  const warns = (
    <>
      {!dbReady && <p className="warn">아직 기록의 샘이 닿지 않아 문헌을 기록할 수 없습니다.</p>}
      {dbReady && err && (
        <p className="warn">
          문헌 표가 아직 없는 듯합니다. 안내된 SQL을 Supabase에서 한 번 실행하십시오.
          <br />
          <span className="dim">({err})</span>
        </p>
      )}
      {storyId == null && <p className="warn">먼저 운명의 장을 펼치십시오.</p>}
    </>
  );

  const hasSel = !!(viewing || editing);
  const inIndex = !topic;

  return (
    <div className="modal-bg" onClick={onClose}>
      <div
        className={
          'modal has-hero modal--lore' + (inIndex ? ' modal--list' : ' modal--codex')
        }
        onClick={(e) => e.stopPropagation()}
      >
        {/* 모바일 풀스크린: 노치/상태바 아래(안전영역) 차폐 */}
        <div className="top-shield" />

        {inIndex ? (
          // ── 첫 화면 — 다섯 영역 배너(표지) ──────────────────────────────
          <>
            <div className="modal-head">
              <div className="head-side" />
              <h2>대륙 문헌</h2>
              <div className="head-actions">
                {storyId != null && (
                  <IconButton label={UI.import} onClick={() => setImporting(true)}>
                    <Download size={17} />
                  </IconButton>
                )}
                <IconButton label={UI.close} onClick={onClose}>
                  <X size={17} />
                </IconButton>
              </div>
            </div>
            {warns}
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
          </>
        ) : (
          // ── 영역 펼침 — 2단(목차 사이드바 + 본문) ────────────────────────
          <div className={'lore-codex' + (hasSel ? ' has-sel' : '')}>
            {/* 왼쪽: 그 영역의 권 목록(목차) */}
            <aside className="lore-side">
              <div className="lore-side-head">
                <IconButton label="영역으로" onClick={backToTopics}>
                  <ArrowLeft size={18} />
                </IconButton>
              </div>
              <div className="lore-vols">
                {loading ? (
                  <Spinner />
                ) : inTopic.length === 0 ? (
                  <div className="empty-state">
                    <p className="empty-state-msg">기록된 문헌이 없습니다.</p>
                    {topic !== ORPHAN && (
                      <Button variant="primary" onClick={() => openNew(topic!)}>
                        첫 문헌 기록
                      </Button>
                    )}
                  </div>
                ) : (
                  <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragEnd={onVolDragEnd}
                  >
                    <SortableContext
                      items={localInTopic.map((e) => e.id!)}
                      strategy={verticalListSortingStrategy}
                    >
                      <ul className="lore-vol-list">
                        {localInTopic.map((e, i) => (
                          <SortableVol
                            key={e.id}
                            e={e}
                            no={i + 1}
                            sel={viewing?.id === e.id && !editing}
                            onView={() => setViewing(e)}
                            onToggle={() => toggleActiveOf(e)}
                          />
                        ))}
                      </ul>
                    </SortableContext>
                  </DndContext>
                )}
              </div>
              {/* 작성 = 하단 원형 플로팅 */}
              {topic !== ORPHAN && inTopic.length > 0 && (
                <button className="lore-fab" onClick={() => openNew(topic!)} title="작성" aria-label="작성">
                  <Feather size={18} />
                </button>
              )}
            </aside>

            {/* 오른쪽: 본문(읽기/편찬/안내) */}
            <div className="lore-main">
              <div className="lore-main-head">
                {hasSel && (
                  <IconButton label="목차로" className="lore-back-m" onClick={backToVols}>
                    <ArrowLeft size={18} />
                  </IconButton>
                )}
                <span className="lore-main-head-sp" />
                {viewing && !editing && (
                  <>
                    <IconButton
                      label={viewing.is_active !== false ? '잠재우기' : '깨우기'}
                      active={viewing.is_active !== false}
                      onClick={toggleActive}
                    >
                      <Bookmark
                        size={18}
                        fill={viewing.is_active !== false ? 'currentColor' : 'none'}
                      />
                    </IconButton>
                    <IconButton label={UI.compile} onClick={() => openEdit(viewing)}>
                      <Pencil size={17} />
                    </IconButton>
                  </>
                )}
                <IconButton label={UI.close} className="lore-close-d" onClick={onClose}>
                  <X size={17} />
                </IconButton>
              </div>

              <div className="lore-main-body">
                {storyId == null || !dbReady || err ? (
                  <div className="lore-prompt">{warns}</div>
                ) : editing ? (
                  // 편찬
                  <div className="editor lore-edit">
                    <div className="row2 lore-fields">
                      <label className="lore-f-area">
                        영역 *
                        <Dropdown
                          value={editing.category || ''}
                          options={TOPICS.map((t) => ({ value: t.title, label: t.title }))}
                          onChange={(v) => set('category', v)}
                        />
                      </label>
                      <label className="lore-f-title">
                        갈래 *
                        <input
                          value={editing.title}
                          onChange={(e) => set('title', e.target.value)}
                        />
                      </label>
                    </div>

                    <div className="lore-secs-wrap">
                      <span className="lore-secs-label">내용</span>
                      <DndContext
                        sensors={sensors}
                        collisionDetection={closestCenter}
                        onDragEnd={onSecDragEnd}
                      >
                        <SortableContext
                          items={secs.map((s) => s.id)}
                          strategy={verticalListSortingStrategy}
                        >
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
                      <div className="add-foot">
                        <IconButton label="항목 추가" onClick={addSec}>
                          <Plus size={17} />
                        </IconButton>
                      </div>
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
                ) : viewing ? (
                  // 읽기(문헌 한 권)
                  <article className="lore-doc">
                    <header className="lore-doc-head">
                      <div className="lore-doc-meta">
                        <span className="lore-doc-vol">
                          제{volNo(viewing)}권 · {viewing.category}
                        </span>
                        <div className="lore-doc-nav">
                          <button
                            disabled={!prevE}
                            onClick={() => prevE && setViewing(prevE)}
                            aria-label="이전 권"
                          >
                            <ChevronLeft size={18} />
                          </button>
                          <button
                            disabled={!nextE}
                            onClick={() => nextE && setViewing(nextE)}
                            aria-label="다음 권"
                          >
                            <ChevronRight size={18} />
                          </button>
                        </div>
                      </div>
                      <div className="lore-doc-headtext">
                        <h1 className="lore-doc-title">{viewing.title}</h1>
                        {tocOf(viewing) && <p className="lore-doc-toc">{tocOf(viewing)}</p>}
                      </div>
                      <div className="lore-doc-rule">
                        <span className="lore-doc-rule-orn" />
                      </div>
                    </header>
                    <div className="lore-doc-body">
                      {viewing.sections?.length ? (
                        viewing.sections.map((s, i) => (
                          <section key={i} className="lore-doc-sec">
                            {s.subtitle && <h3 className="lore-doc-subtitle">{s.subtitle}</h3>}
                            {s.content?.trim() && <Markdown text={s.content} />}
                          </section>
                        ))
                      ) : viewing.body?.trim() ? (
                        <Markdown text={viewing.body} />
                      ) : (
                        <p className="dim small">아직 적힌 내용이 없습니다.</p>
                      )}
                    </div>
                  </article>
                ) : (
                  // 선택 안내(데스크탑 우측 빈 칸)
                  <div className="lore-prompt">
                    <BookOpen size={34} className="lore-prompt-ico" />
                    <p className="lore-prompt-msg">열람할 문헌을 펼치십시오</p>
                    <p className="lore-prompt-sub">좌측 목록에서 한 권을 고르거나, 새로 기록할 수 있습니다.</p>
                  </div>
                )}
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
            noun="문헌"
            onClose={() => setImporting(false)}
            onDone={refresh}
          />
        )}
      </div>
    </div>
  );
}
