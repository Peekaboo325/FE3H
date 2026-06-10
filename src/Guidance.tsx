import { useEffect, useState } from 'react';
import { UI } from './strings';
import { showToast } from './toast';
import Modal from './Modal';
import Button from './Button';
import Spinner from './Spinner';

// 기록 지침 — 기록자(유저)가 직접 적어 모든 이야기의 본문에 함께 얹는 전역 집필 지침.
//  박제된 worldview 규약 위에 실시간으로 얹는 개인 지침서. 저장 즉시 다음 본문부터 반영.
export default function Guidance({ onClose }: { onClose: () => void }) {
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dbOk, setDbOk] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      try {
        const r = await fetch('/api/guidance');
        const d = await r.json();
        if (!alive) return;
        setDbOk(!!d.dbReady);
        setText(typeof d.text === 'string' ? d.text : '');
      } catch {
        /* 무시 */
      }
      if (alive) setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, []);

  const 기록 = async () => {
    setSaving(true);
    try {
      const r = await fetch('/api/guidance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });
      const d = await r.json();
      if (d.ok) showToast('기록되었습니다.');
      else showToast('지침을 기록하지 못했습니다.');
    } catch {
      showToast('지침을 기록하지 못했습니다.');
    }
    setSaving(false);
  };

  return (
    <Modal onClose={onClose} title="기록 지침">
        {!dbOk && <p className="warn">기록의 샘이 닿지 않아 지침을 펼칠 수 없습니다.</p>}

        <div className="modal-body">
          {loading ? (
            <Spinner />
          ) : (
            <>
              <textarea
                className="guidance-area"
                value={text}
                onChange={(e) => setText(e.target.value)}
              />
              <div className="guidance-foot">
                <Button variant="primary" loading={saving} onClick={기록}>
                  {UI.save}
                </Button>
              </div>
            </>
          )}
        </div>
    </Modal>
  );
}
