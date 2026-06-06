// 앱 내부 디제틱 다이얼로그 — 브라우저 alert/confirm을 대신한다.
// 약속(Promise) 기반 명령형 API라, 비동기 함수 안에서 `await confirmAsk(...)`처럼 쓴다.
// 루트에 <DialogHost/> 하나만 띄워 두면 어디서 부르든 그 위에 그려진다.

import { useEffect, useState } from 'react';

type ConfirmOpts = {
  message: string;
  detail?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
};
type AlertOpts = { message: string; detail?: string; okLabel?: string };

type Req =
  | { kind: 'confirm'; opts: ConfirmOpts; resolve: (v: boolean) => void }
  | { kind: 'alert'; opts: AlertOpts; resolve: () => void };

let current: Req | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export function confirmAsk(opts: ConfirmOpts): Promise<boolean> {
  return new Promise((resolve) => {
    current = { kind: 'confirm', opts, resolve };
    emit();
  });
}

export function alertAsk(opts: AlertOpts): Promise<void> {
  return new Promise((resolve) => {
    current = { kind: 'alert', opts, resolve };
    emit();
  });
}

export function DialogHost() {
  const [, force] = useState(0);
  useEffect(() => {
    const l = () => force((n) => n + 1);
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  }, []);

  const req = current;

  // 열려 있는 동안: Enter=확정, Esc=취소.
  useEffect(() => {
    if (!req) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter') 닫기(true);
      if (e.key === 'Escape') 닫기(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [req]);

  if (!req) return null;

  function 닫기(확정: boolean) {
    const r = req!;
    current = null;
    emit();
    if (r.kind === 'confirm') r.resolve(확정);
    else r.resolve();
  }

  const isConfirm = req.kind === 'confirm';
  const o = req.opts;

  return (
    <div className="dialog-bg" onClick={() => 닫기(false)}>
      <div className="dialog" onClick={(e) => e.stopPropagation()}>
        <p className="dialog-msg">{o.message}</p>
        {o.detail && <p className="dialog-detail">{o.detail}</p>}
        <div className="dialog-actions">
          {isConfirm && (
            <button className="dialog-btn" onClick={() => 닫기(false)}>
              {(o as ConfirmOpts).cancelLabel || '철회'}
            </button>
          )}
          <button
            className={'dialog-btn primary' + (isConfirm && (o as ConfirmOpts).danger ? ' danger' : '')}
            onClick={() => 닫기(true)}
          >
            {isConfirm ? (o as ConfirmOpts).confirmLabel || '확인' : (o as AlertOpts).okLabel || '확인'}
          </button>
        </div>
      </div>
    </div>
  );
}
