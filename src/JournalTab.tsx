// 일지(日誌) 탭 — 인물의 '사적 연대기'. 서신의 안쪽 짝(밖↔안).
//  목록(순번 라벨 + 본문 첫머리) → 상세 뷰(서신 뷰어와 동일한 종이 카드·툴바·편집·소각).
//  ⚠️ 인물이 단 '제목'은 없다(일기는 표제를 안 단다). 화면의 "첫번째 일지…"는 인물이 쓴 게
//     아니라 유저 편의용 순번 색인일 뿐 — 저장·모델 입력엔 안 들어간다. 설계 = docs/일지_설계.md.
import { useState } from 'react';
import { ArrowLeft, Feather, Pencil, Trash2 } from 'lucide-react';
import { UI } from './strings';
import IconButton from './IconButton';
import Button from './Button';
import Spinner from './Spinner';
import Markdown from './Markdown';
import type { CharReport, JournalEntry } from './useCharacters';

// 한글 native 서수 — "첫번째/두번째/…/스무번째/스물한번째". 1~99 밖이면 "N번째"로 폴백.
const 서수단위 = ['', '한', '두', '세', '네', '다섯', '여섯', '일곱', '여덟', '아홉'];
const 서수십 = ['', '열', '스물', '서른', '마흔', '쉰', '예순', '일흔', '여든', '아흔'];
function 한글서수(n: number): string {
  if (n < 1 || n > 99) return `${n}번째`;
  if (n === 1) return '첫번째';
  if (n === 20) return '스무번째'; // 20만 '스물'→'스무'
  return 서수십[Math.floor(n / 10)] + 서수단위[n % 10] + '번째';
}
const 라벨 = (순번: number) => `${한글서수(순번)} 일지`;

// 미작성/술회 중 화면용 골격 — 흐릿하게 깔리므로 내용은 자리채움(제목 없이 본문만).
const 골격일지: JournalEntry[] = [
  { body: '새벽 종소리에 눈을 떴다. 멀건 죽 한 그릇으로 속을 데우고, 늘 그렇듯 마당을 한 바퀴 돌았다. 별일 없는 하루였다.' },
  { body: '요 며칠 마음이 자꾸 한곳에 머문다. 낮의 소임은 손에 익어 무던히 흘렀는데, 밤이 되니 그 한마디가 다시 떠오른다.' },
];

// 목록 행 — 순번 라벨 + 본문 첫머리 2줄(연대 문헌 클래스 재사용).
function JournalRow({ label, e, onOpen }: { label: string; e: JournalEntry; onOpen: () => void }) {
  return (
    <button className="chronicle-row" onClick={onOpen}>
      <div className="chronicle-title">{label}</div>
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
  onSave: (e: JournalEntry, fields: { body: string }) => Promise<boolean>;
}) {
  const journals = report?.journals;
  const [openId, setOpenId] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [body, setBody] = useState('');
  const [saving, setSaving] = useState(false);
  // 최신이 위(배열 앞). 순번은 오래된 것=첫번째 → 위로 갈수록 커진다(N-i).
  const openIndex = journals?.findIndex((j) => j.id === openId) ?? -1;
  const open = openIndex >= 0 ? journals![openIndex] : null;

  async function 기록() {
    if (!open || saving) return;
    setSaving(true);
    const ok = await onSave(open, { body });
    setSaving(false);
    if (ok) setEditing(false);
  }

  // 첫 술회 중(일지 없음) — 골격 흐리고 스피너로 '작동 중'.
  if (journaling && !journals?.length) {
    return (
      <div className="report-locked">
        <div className="journal-list report--ghost" aria-hidden="true">
          {골격일지.map((e, i) => (
            <JournalRow key={i} label={라벨(골격일지.length - i)} e={e} onOpen={() => {}} />
          ))}
        </div>
        <div className="report-lock-overlay">
          <Spinner />
        </div>
      </div>
    );
  }

  // 상세(한 장 펼침) — 서신 뷰어와 동일한 골격(letter-* 클래스 재사용). 머리=순번 라벨, 메타·서명은 없다.
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
                  setBody(open.body);
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
          <h3 className="letter-title">{라벨(journals!.length - openIndex)}</h3>
          <div className="letter-body">
            {editing ? (
              <textarea
                className="letter-body-input"
                value={body}
                onChange={(e) => setBody(e.target.value)}
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
          {journals.map((e, i) => (
            <JournalRow key={e.id} label={라벨(journals.length - i)} e={e} onOpen={() => setOpenId(e.id!)} />
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
          <JournalRow key={i} label={라벨(골격일지.length - i)} e={e} onOpen={() => {}} />
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
