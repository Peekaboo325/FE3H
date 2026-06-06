import { useState, useEffect } from 'react';
import { 이미지를_썸네일로 } from './imageUtils';
import { alertAsk } from './dialog';
import { useCharacters, type Character } from './useCharacters';
import ImportDialog from './ImportDialog';
import FaceCrop from './FaceCrop';
import { nameDict } from './nameDict.generated';
import { splitAliases } from './nameUtils';

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

// 뷰 모드의 한 섹션(내용 있을 때만 호출).
function ViewSection({ label, text }: { label: string; text: string }) {
  return (
    <div className="view-section">
      <div className="view-label">{label}</div>
      <div className="view-text">{text}</div>
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

  const viewMode = viewing && !editing; // 순수 읽기 모드

  return (
    <div className="modal-bg" onClick={onClose}>
      <div className={'modal' + (viewMode ? ' has-hero' : '')} onClick={(e) => e.stopPropagation()}>
        {/* 헤더·안내 — 뷰 모드에선 히어로가 대신하므로 숨김 */}
        {!viewMode && (
          <>
            <div className="modal-head">
              <h2>{editing ? (editing.id ? '인물 편집' : '새 인물') : '인물 명부'}</h2>
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
                  ←
                </button>
                <div className="hero-top-right">
                  <button className="hero-btn" onClick={() => setEditing(viewing)}>
                    편집
                  </button>
                  <button className="hero-btn" onClick={onClose} aria-label="닫기">
                    ✕
                  </button>
                </div>
              </div>
              <div className="char-hero-portrait">
                <img src={viewing.thumbnail || viewing.avatar || HERO_PLACEHOLDER} alt="" />
              </div>
              <div className="char-hero-info">
                <div className="char-hero-name">
                  {viewing.name}
                  {viewing.life_status === 'deceased' && <span className="tag">故</span>}
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
                  <div className="info-card">
                    <div className="info-card-title">신원</div>
                    {viewing.faction && <InfoRow label="소속" value={viewing.faction} />}
                    {viewing.rank && <InfoRow label="신분" value={viewing.rank} />}
                    {viewing.crest && <InfoRow label="문장" value={viewing.crest} />}
                    <InfoRow label="상태" value={상태label[viewing.life_status || 'alive']} />
                  </div>
                  {viewing.appearance && <ViewSection label="용모" text={viewing.appearance} />}
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
            <button className="new" onClick={() => setEditing(빈인물())}>
              ＋ 새 인물
            </button>
            {storyId != null && (
              <button className="new" onClick={() => setImporting(true)}>
                ↧ 다른 장에서 반입
              </button>
            )}
            {loading ? (
              <p className="dim">펼치는 중…</p>
            ) : chars.length === 0 ? (
              <p className="dim">아직 기록된 인물이 없어요.</p>
            ) : (
              <ul className="char-list">
                {chars.map((c) => (
                  <li key={c.id} className="char-row" onClick={() => setViewing(c)}>
                    <img className="thumb round" src={c.avatar || c.thumbnail || LIST_PLACEHOLDER} alt="" />
                    <div className="char-meta">
                      <div className="char-name">
                        {c.name}
                        {c.life_status === 'deceased' && <span className="tag">故</span>}
                        {c.is_active === false && <span className="tag dimtag">잠듦</span>}
                      </div>
                      <div className="char-sub">{splitAliases(c.aliases)[0] || ''}</div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {/* 편집 화면 */}
        {editing && (
          <div className="modal-body editor">
            <div className="thumb-edit">
              <img className="thumb big" src={editing.thumbnail || HERO_PLACEHOLDER} alt="" />
              <label className="filebtn">
                초상 올리기
                <input type="file" accept="image/*" onChange={onPickImage} hidden />
              </label>
              {editing.thumbnail && (
                <div className="thumb-edit-links">
                  <button className="link" onClick={() => setCropping(true)}>
                    {editing.avatar ? '얼굴 다시 따기 ▸' : '여기서 얼굴 따기 ▸'}
                  </button>
                  {editing.avatar && (
                    <button className="link" onClick={() => set('avatar', '')}>
                      얼굴 지우기
                    </button>
                  )}
                  <button className="link" onClick={() => set('thumbnail', '')}>
                    초상 지우기
                  </button>
                </div>
              )}
            </div>
            <p className="dim small">
              WebP로 자동 변환됩니다(투명 배경 유지·고화질). 초상을 올린 뒤 <b>‘여기서 얼굴 따기’</b>로
              둥근 명부 얼굴을 만드세요. 안 만들면 목록엔 초상이 그대로 쓰입니다.
            </p>

            <div className="editor-section">신원</div>

            <div className="row2">
              <label>
                성명 *
                <input
                  value={editing.name}
                  onChange={(e) => set('name', e.target.value)}
                  onBlur={() => {
                    // 사전에 정확히 있는 성명이고 영문명이 비어 있으면 자동 채움(원작 표기)
                    const en = nameDict[editing.name.trim()];
                    if (en && !editing.english_name?.trim()) set('english_name', en);
                  }}
                />
              </label>
              <label>
                영문명
                <input
                  value={editing.english_name || ''}
                  onChange={(e) => set('english_name', e.target.value)}
                />
              </label>
            </div>

            <label>
              이명 (쉼표로 구분 — 예: 사자왕, 폭풍의 왕)
              <input value={editing.aliases || ''} onChange={(e) => set('aliases', e.target.value)} />
            </label>

            <label>
              소속
              <input
                value={editing.faction || ''}
                onChange={(e) => set('faction', e.target.value)}
                placeholder="예: 퍼거스 신성 왕국"
              />
            </label>
            <label>
              신분
              <input
                value={editing.rank || ''}
                onChange={(e) => set('rank', e.target.value)}
                placeholder="예: 왕자 / 국왕"
              />
            </label>
            <label>
              문장
              <input
                value={editing.crest || ''}
                onChange={(e) => set('crest', e.target.value)}
                placeholder="예: 블레다드의 소문장"
              />
            </label>
            <label>
              상태
              <select
                value={editing.life_status || 'alive'}
                onChange={(e) => set('life_status', e.target.value as Character['life_status'])}
              >
                <option value="alive">생존</option>
                <option value="deceased">사망</option>
                <option value="unknown">불명</option>
              </select>
            </label>

            <label>
              용모
              <textarea
                rows={2}
                value={editing.appearance || ''}
                onChange={(e) => set('appearance', e.target.value)}
                placeholder="머리·눈·체격 등"
              />
            </label>
            <label>
              성향
              <textarea
                rows={3}
                value={editing.personality || ''}
                onChange={(e) => set('personality', e.target.value)}
                placeholder="외면 성격, 내면, 특징…"
              />
            </label>
            <label>
              전법
              <textarea
                rows={2}
                value={editing.combat || ''}
                onChange={(e) => set('combat', e.target.value)}
                placeholder="주무기, 병종, 영웅의 유산·문장…"
              />
            </label>
            <label>
              비고
              <textarea
                rows={2}
                value={editing.notes || ''}
                onChange={(e) => set('notes', e.target.value)}
              />
            </label>

            <label className="check">
              <input
                type="checkbox"
                checked={editing.is_active !== false}
                onChange={(e) => set('is_active', e.target.checked)}
              />
              활성 (지금 이야기에 등장)
            </label>

            <div className="editor-actions">
              <button className="primary" onClick={save} disabled={saving}>
                {saving ? '기록하는 중…' : '기록'}
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
