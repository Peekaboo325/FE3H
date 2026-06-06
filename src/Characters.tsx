import { useState, useEffect } from 'react';
import { 이미지를_썸네일로 } from './imageUtils';
import { alertAsk } from './dialog';
import { useCharacters, type Character } from './useCharacters';
import ImportDialog from './ImportDialog';
import FaceCrop from './FaceCrop';
import { nameDict } from './nameDict.generated';
import { splitAliases } from './nameUtils';
import Markdown from './Markdown';
import Dropdown from './Dropdown';
import { ImagePlus, Crop, Eraser, Flame, ArrowLeft, Bookmark, Pencil, X } from 'lucide-react';
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
const HERO_PLACEHOLDER = '/avatar-placeholder.webp'; // 히어로(인물 카드)용
const LIST_PLACEHOLDER = '/portrait-placeholder.webp'; // 명부 목록 둥근 썸네일용

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

// 신원 카드의 한 줄(라벨 + 값).
function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="info-row">
      <span className="info-row-label">{label}</span>
      <span className="info-row-value">{value}</span>
    </div>
  );
}

// 드래그로 정렬 가능한 목록 행.
function SortableCharRow({
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
  return (
    <li
      ref={setNodeRef}
      style={style}
      className={'char-row' + (active ? '' : ' inactive')}
      onClick={onOpen}
      {...attributes}
      {...listeners}
    >
      <span className="thumb-wrap">
        <img
          className={'thumb round ' + statusFx(c.life_status)}
          src={c.avatar || c.thumbnail || LIST_PLACEHOLDER}
          alt=""
        />
        {c.life_status === 'unknown' && <span className="thumb-q">?</span>}
      </span>
      <div className="char-meta">
        <div className="char-name">
          {c.name}
          {c.life_status === 'deceased' && <span className="tag">사망</span>}
        </div>
        <div className="char-sub">{splitAliases(c.aliases)[0] || ''}</div>
      </div>
      <button
        className={'row-bm' + (active ? ' on' : '')}
        onClick={(e) => {
          e.stopPropagation();
          onToggle();
        }}
        onPointerDown={(e) => e.stopPropagation()}
        aria-label={active ? '등장 끄기' : '등장 켜기'}
      >
        <Bookmark size={16} fill={active ? 'currentColor' : 'none'} />
      </button>
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
  const [armed, setArmed] = useState(false); // 삭제 두 번 누르기: 첫 클릭=활성, 둘째=실행
  useEffect(() => setArmed(false), [editing]); // 다른 인물로 옮기거나 닫으면 해제
  useEffect(() => setTab('약력'), [viewing]); // 다른 인물 열면 약력부터

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
      await alertAsk({ message: '초상을 올리지 못했어요.', detail: (err as Error).message });
    }
  }

  async function save() {
    if (!editing) return;
    if (!editing.name.trim()) {
      await alertAsk({ message: '성명은 꼭 필요해요.' });
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/characters', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ character: { ...editing, story_id: storyId } }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        await alertAsk({ message: '기록하지 못했어요.', detail: data.error || '알 수 없는 까닭' });
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
      await alertAsk({ message: '지우지 못했어요.', detail: data.error || undefined });
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

  const viewMode = viewing && !editing; // 순수 읽기 모드

  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal has-hero" onClick={(e) => e.stopPropagation()}>
        {/* 헤더·안내 — 뷰/편집 모드에선 히어로가 대신하므로 숨김(목록 모드 전용) */}
        {!viewMode && !editing && (
          <>
            <div className="modal-head">
              <h2>인물 명부</h2>
              <button className="x" onClick={onClose}>
                ✕
              </button>
            </div>

            {!dbReady && <p className="warn">아직 기록의 샘이 닿지 않아 인물을 기록할 수 없어요.</p>}
            {dbReady && err && (
              <p className="warn">
                인물 표가 아직 없는 것 같아요. 안내된 SQL을 Supabase에서 한 번 실행해 주세요.
                <br />
                <span className="dim">({err})</span>
              </p>
            )}
            {storyId == null && <p className="warn">이야기를 먼저 만들어 주세요.</p>}
          </>
        )}

        {/* 뷰(읽기) 화면 */}
        {viewMode && viewing && (
          <div className="char-view">
            <div className="char-hero">
              <div className="char-hero-top">
                <button className="hero-btn" onClick={() => setViewing(null)} aria-label="목록으로">
                  <ArrowLeft size={18} />
                </button>
                <div className="hero-top-right">
                  <button
                    className={'hero-btn' + (viewing.is_active !== false ? ' on' : '')}
                    onClick={toggleActive}
                    aria-label={viewing.is_active !== false ? '등장 끄기' : '등장 켜기'}
                  >
                    <Bookmark size={18} fill={viewing.is_active !== false ? 'currentColor' : 'none'} />
                  </button>
                  <button className="hero-btn" onClick={() => setEditing(viewing)} aria-label="편집">
                    <Pencil size={17} />
                  </button>
                  <button className="hero-btn" onClick={onClose} aria-label="닫기">
                    <X size={18} />
                  </button>
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
                  {viewing.is_active === false && (
                    <p className="dim small">지금 이야기엔 잠들어 있는 인물입니다.</p>
                  )}
                </>
              ) : (
                <EmptyTab />
              )}
            </div>
          </div>
        )}

        {/* 목록 화면 */}
        {!editing && !viewing && (
          <div className="modal-body">
            <div className="list-actions">
              <button className="list-btn" onClick={() => setEditing(빈인물())}>
                ＋ 명부 추가
              </button>
              {storyId != null && (
                <button className="list-btn" onClick={() => setImporting(true)}>
                  ↧ 명부 반입
                </button>
              )}
            </div>
            {loading ? (
              <p className="dim">펼치는 중…</p>
            ) : chars.length === 0 ? (
              <p className="dim">아직 기록된 인물이 없어요.</p>
            ) : (
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
                <SortableContext
                  items={items.map((c) => c.id!)}
                  strategy={verticalListSortingStrategy}
                >
                  <ul className="char-list">
                    {items.map((c) => (
                      <SortableCharRow
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
                <button className="hero-btn" onClick={() => setEditing(null)} aria-label="취소">
                  <ArrowLeft size={18} />
                </button>
                <div className="hero-top-right">
                  <button className="hero-btn" onClick={onClose} aria-label="닫기">
                    <X size={18} />
                  </button>
                </div>
              </div>
              <div className="char-hero-portrait">
                <img
                  className={statusFx(editing.life_status)}
                  src={editing.thumbnail || HERO_PLACEHOLDER}
                  alt=""
                />
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
                    className="hero-inp name"
                    value={editing.name}
                    onChange={(e) => set('name', e.target.value)}
                    onBlur={() => {
                      const en = nameDict[editing.name.trim()];
                      if (en && !editing.english_name?.trim()) set('english_name', en);
                    }}
                  />
                </label>
                <label className="hero-field">
                  <span className="hero-lab">영문명</span>
                  <input
                    className="hero-inp en"
                    value={editing.english_name || ''}
                    onChange={(e) => set('english_name', e.target.value)}
                  />
                </label>
                <label className="hero-field">
                  <span className="hero-lab">이명 (쉼표로 구분)</span>
                  <input
                    className="hero-inp"
                    value={editing.aliases || ''}
                    onChange={(e) => set('aliases', e.target.value)}
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

              <div className="editor-actions">
                <button className="primary" onClick={save} disabled={saving}>
                  {saving ? <span className="spinner" /> : '기록'}
                </button>
                <button onClick={() => setEditing(null)}>취소</button>
                {editing.id && (
                  <button
                    className={'danger' + (armed ? ' armed' : '')}
                    onClick={() => (armed ? remove() : setArmed(true))}
                  >
                    소각
                  </button>
                )}
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
            title="인물 반입"
            endpoint="/api/characters"
            itemsKey="characters"
            payloadKey="character"
            currentStoryId={storyId}
            labelOf={(c) => c.name}
            onClose={() => setImporting(false)}
            onDone={refresh}
          />
        )}
      </div>
    </div>
  );
}
