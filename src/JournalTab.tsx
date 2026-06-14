// 일지(日誌) 탭 — 인물의 '사적 연대기'. 서신의 안쪽 짝(밖↔안).
//  목록(연대 문헌식 미리보기) → 상세 뷰(서신 뷰어와 동일한 종이 카드·툴바·편집·소각).
//  서신에서 빌림: 종이 카드·툴바·편집/소각·술회 FAB·스피너. 덜어냄: 발신수신 메타·서명(흘림체).
//  날것·수수한 사적 페이지 — 설계 = docs/일지_설계.md.
import { useState } from 'react';
import { ArrowLeft, Feather, Pencil, Trash2 } from 'lucide-react';
import { UI } from './strings';
import IconButton from './IconButton';
import Button from './Button';
import Spinner from './Spinner';
import Markdown from './Markdown';
import type { CharReport, JournalEntry } from './useCharacters';

// 미작성/술회 중 화면용 골격 — 흐릿하게 깔리므로 내용은 자리채움.
const 골격일지: JournalEntry[] = [
  { title: '여느 날', body: '새벽 종소리에 눈을 떴다. 멀건 죽 한 그릇으로 속을 데우고, 늘 그렇듯 마당을 한 바퀴 돌았다. 별일 없는 하루였다.' },
  { title: '잠 못 드는 밤', body: '요 며칠 마음이 자꾸 한곳에 머문다. 낮의 소임은 손에 익어 무던히 흘렀는데, 밤이 되니 그 한마디가 다시 떠오른다.' },
];

// 목록 행 — 제목 + 본문 2줄 미리보기(연대 문헌 클래스 재사용).
function JournalRow({ e, onOpen }: { e: JournalEntry; onOpen: () => void }) {
  return (
    <button className="chronicle-row" onClick={onOpen}>
      <div className="chronicle-title">{e.title || '제목 없는 날'}</div>
      <p className="chronicle-summary clamp2">{e.body}</p>
    </button>
  );
}

export default function JournalTab({
  report,
  journaling,
  onWrite,
  onBurn,
  onSave,
}: {
  report?: CharReport | null;
  journaling: boolean;
  onWrite: () => void;
  onBurn: (e: JournalEntry) => void;
  onSave: (e: JournalEntry, fields: { title: string; body: string }) => Promise<boolean>;
}) {
  const journals = report?.journals;
  const [openId, setOpenId] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ title: '', body: '' });
  const [saving, setSaving] = useState(false);
  const open = journals?.find((j) => j.id === openId) || null;

  async function 기록() {
    if (!open || saving) return;
    setSaving(true);
    const ok = await onSave(open, form);
    setSaving(false);
    if (ok) setEditing(false);
  }

  // 첫 술회 중(일지 없음) — 골격 흐리고 스피너로 '작동 중'.
  if (journaling && !journals?.length) {
    return (
      <div className="report-locked">
        <div className="journal-list report--ghost" aria-hidden="true">
          {골격일지.map((e, i) => (
            <JournalRow key={i} e={e} onOpen={() => {}} />
          ))}
        </div>
        <div className="report-lock-overlay">
          <Spinner />
        </div>
      </div>
    );
  }

  // 상세(한 장 펼침) — 서신 뷰어와 동일한 골격(letter-* 클래스 재사용).
  if (open) {
    return (
      <div className="letter-view">
        <div className="letter-toolbar">
          <IconButton
            label="목록"
            onClick={() => {
              setOpenId(null);
              setEditing(false);
            }}
          >
            <ArrowLeft size={17} />
          </IconButton>
          <div className="letter-tool-right">
            {!editing && (
              <IconButton
                label={UI.edit}
                onClick={() => {
                  setForm({ title: open.title || '', body: open.body });
                  setEditing(true);
                }}
              >
                <Pencil size={15} />
              </IconButton>
            )}
            <IconButton label={UI.erase} onClick={() => onBurn(open)}>
              <Trash2 size={15} />
            </IconButton>
          </div>
        </div>

        <div className="letter-paper">
          {editing ? (
            <input
              className="letter-title-input"
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            />
          ) : (
            open.title && <h3 className="letter-title">{open.title}</h3>
          )}
          <div className="letter-body">
            {editing ? (
              <textarea
                className="letter-body-input"
                value={form.body}
                onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))}
              />
            ) : (
              <Markdown text={open.body} />
            )}
          </div>
          {editing && (
            <div className="letter-edit-actions">
              <Button variant="secondary" onClick={() => setEditing(false)}>
                {UI.cancel}
              </Button>
              <Button variant="primary" loading={saving} onClick={기록}>
                {UI.save}
              </Button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // 목록 — 일지장(최신이 위) + 하단 술회 FAB.
  if (journals?.length) {
    return (
      <div className="journal">
        <div className="journal-list">
          {journals.map((e) => (
            <JournalRow key={e.id} e={e} onOpen={() => setOpenId(e.id!)} />
          ))}
        </div>
        <div className="report-foot">
          <IconButton label={UI.journalize} onClick={onWrite} disabled={journaling}>
            {journaling ? <span className="spinner" /> : <Feather size={17} />}
          </IconButton>
        </div>
      </div>
    );
  }

  // 미작성 — 골격 흐리고 위쪽에 안내·술회 버튼.
  return (
    <div className="report-locked">
      <div className="journal-list report--ghost" aria-hidden="true">
        {골격일지.map((e, i) => (
          <JournalRow key={i} e={e} onOpen={() => {}} />
        ))}
      </div>
      <div className="report-lock-overlay">
        <p className="report-lock-msg">적힌 일지가 없습니다.</p>
        <button className="list-btn" onClick={onWrite}>
          일지 기록
        </button>
      </div>
    </div>
  );
}
