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
  BookOpen,
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
  const orphans = entries.filter((e) => !TOPIC_TITLES.includes(e.category || ''));
  // 제N권 = 그 영역 안에서의 순번(앵커 '세력 제N권'과 일치)
  const volNo = (e: Lore) => inTopic.findIndex((x) => x.id === e.id) + 1;

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
              <div className="head-left">
                <h2>대륙 문헌</h2>
              </div>
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
                <h3 className="lore-side-title">
                  {topic === ORPHAN ? '미분류' : topic}
                  {inTopic.length > 0 && <span className="head-count">{inTopic.length}</span>}
                </h3>
              </div>
              <div className="lore-vols">
                {loading ? (
                  <Spinner />
                ) : inTopic.length === 0 ? (
                  <div className="empty-state">
                    <p className="empty-state-msg">기록된 문헌이 없습니다.</p>
                    {topic !== ORPHAN && (
                      <button className="btn-accent" onClick={() => openNew(topic!)}>
                        첫 문헌 기록
                      </button>
                    )}
                  </div>
                ) : (
                  <ul className="lore-vol-list">
                    {inTopic.map((e) => {
                      const sel = viewing?.id === e.id && !editing;
                      return (
                        <li
                          key={e.id}
                          className={
                            'lore-vol' +
                            (sel ? ' sel' : '') +
                            (e.is_active === false ? ' inactive' : '')
                          }
                        >
                          <div className="lore-vol-meta" onClick={() => setViewing(e)}>
                            <span className="lore-vol-no">제{volNo(e)}권</span>
                            <div className="lore-vol-title">{e.title}</div>
                            {tocOf(e) && <div className="lore-vol-toc">{tocOf(e)}</div>}
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
                            <Bookmark
                              size={17}
                              fill={e.is_active !== false ? 'currentColor' : 'none'}
                            />
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
              {/* 작성 = 하단 원형 플로팅 */}
              {topic !== ORPHAN && inTopic.length > 0 && (
                <button className="lore-fab" onClick={() => openNew(topic!)} title="작성" aria-label="작성">
                  <Plus size={22} />
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
                      <h1 className="lore-doc-title">{viewing.title}</h1>
                      {tocOf(viewing) && <p className="lore-doc-toc">{tocOf(viewing)}</p>}
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
