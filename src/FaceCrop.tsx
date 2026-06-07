import { useState, useRef, useEffect } from 'react';
import { X } from 'lucide-react';
import { UI } from './strings';
import IconButton from './IconButton';

// 초상(thumbnail)에서 얼굴 영역을 네모로 집어 둥근 명부 썸네일(avatar)을 만든다.
// - 외부 라이브러리 없이 캔버스로 그 자리에서 크롭(512px·WebP·투명 보존).
// - 마우스/터치 모두 지원(pointer 이벤트 + touch-action:none).
export default function FaceCrop({
  src,
  onDone,
  onCancel,
}: {
  src: string;
  onDone: (dataUrl: string) => void;
  onCancel: () => void;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const drag = useRef<{ px: number; py: number; ox: number; oy: number } | null>(null);
  const [disp, setDisp] = useState({ w: 0, h: 0 }); // 화면에 그린 이미지 크기
  const [sel, setSel] = useState({ x: 0, y: 0, s: 0 }); // 선택 네모(화면 좌표)

  // 이미지를 읽어 자연 크기 → 화면 표시 크기 계산, 초기 네모를 얼굴 위치쯤에 둠
  useEffect(() => {
    const im = new Image();
    im.onload = () => {
      imgRef.current = im;
      const maxW = Math.min(360, wrapRef.current?.clientWidth || 360);
      const scale = Math.min(1, maxW / im.naturalWidth);
      const w = Math.round(im.naturalWidth * scale);
      const h = Math.round(im.naturalHeight * scale);
      setDisp({ w, h });
      const s = Math.round(Math.min(w, h) * 0.55);
      // 얼굴은 보통 위쪽 → 세로 25% 지점에서 시작
      setSel(clampTo(Math.round((w - s) / 2), Math.round((h - s) * 0.25), s, w, h));
    };
    im.src = src;
  }, [src]);

  function clampTo(x: number, y: number, s: number, w: number, h: number) {
    return {
      x: Math.max(0, Math.min(x, w - s)),
      y: Math.max(0, Math.min(y, h - s)),
      s,
    };
  }

  function onPointerDown(e: React.PointerEvent) {
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    drag.current = { px: e.clientX, py: e.clientY, ox: sel.x, oy: sel.y };
  }
  function onPointerMove(e: React.PointerEvent) {
    if (!drag.current) return;
    const dx = e.clientX - drag.current.px;
    const dy = e.clientY - drag.current.py;
    setSel((s) => clampTo(drag.current!.ox + dx, drag.current!.oy + dy, s.s, disp.w, disp.h));
  }
  function onPointerUp() {
    drag.current = null;
  }
  function onSize(e: React.ChangeEvent<HTMLInputElement>) {
    const s = Number(e.target.value);
    setSel((p) => clampTo(p.x, p.y, s, disp.w, disp.h));
  }

  function confirm() {
    const im = imgRef.current;
    if (!im || sel.s <= 0) return;
    const k = im.naturalWidth / disp.w; // 화면 → 원본 배율
    const OUT = 512;
    const canvas = document.createElement('canvas');
    canvas.width = OUT;
    canvas.height = OUT;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    // 투명 보존: 배경을 깔지 않고 그대로 그림
    ctx.drawImage(im, sel.x * k, sel.y * k, sel.s * k, sel.s * k, 0, 0, OUT, OUT);
    onDone(canvas.toDataURL('image/webp', 0.85));
  }

  const maxS = Math.max(8, Math.min(disp.w, disp.h));
  const minS = Math.max(8, Math.round(maxS * 0.25));

  return (
    <div className="modal-bg" onClick={onCancel}>
      <div className="modal crop-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2>초점 지정</h2>
          <IconButton label={UI.cancel} onClick={onCancel}>
            <X size={17} />
          </IconButton>
        </div>
        <div className="crop-stage" ref={wrapRef}>
          {disp.w > 0 && (
            <div className="crop-canvas" style={{ width: disp.w, height: disp.h }}>
              <img src={src} width={disp.w} height={disp.h} draggable={false} alt="" />
              {sel.s > 0 && (
                <div
                  className="crop-box"
                  style={{ left: sel.x, top: sel.y, width: sel.s, height: sel.s }}
                  onPointerDown={onPointerDown}
                  onPointerMove={onPointerMove}
                  onPointerUp={onPointerUp}
                />
              )}
            </div>
          )}
        </div>
        {disp.w > 0 && (
          <input
            className="crop-range"
            type="range"
            min={minS}
            max={maxS}
            value={sel.s}
            onChange={onSize}
          />
        )}
        <div className="editor-actions">
          <button className="primary" onClick={confirm} disabled={sel.s <= 0}>
            지정
          </button>
          <button onClick={onCancel}>{UI.cancel}</button>
        </div>
      </div>
    </div>
  );
}
