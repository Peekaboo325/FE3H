// 물자 조달 — 점포 6에서 입하한 물건을 인물 소지품에 '조달'(선물). 설계 = docs/물자조달_설계.md.
//  소지품의 그림·카드를 재사용. 점포 목록 → 진열(9점)+새로 입하 → 물건 골라 인물에게 조달.
import { useCallback, useEffect, useState } from 'react';
import Modal from './Modal';
import Spinner from './Spinner';
import Button from './Button';
import { showToast } from './toast';
import { UI } from './strings';
import { useCharacters } from './useCharacters';
import { firstName } from './nameUtils';
import type { BelongingItem } from './useCharacters';

type Shop = { key: string; label: string };
type Stock = Record<string, BelongingItem[]>;

// 물건 그림 — 소지품 ItemIcon과 같은 결(없거나 못 읽으면 공용 문양).
function SupplyIcon({ icon }: { icon?: string }) {
  const [broken, setBroken] = useState<string | null>(null);
  const resolved = icon && broken !== icon ? icon : 'fallback';
  return (
    <div className="item-icon">
      <img
        key={resolved}
        src={`/assets/illust/items/${resolved}.webp`}
        alt=""
        draggable={false}
        onError={() => {
          if (resolved !== 'fallback') setBroken(icon ?? null);
        }}
      />
    </div>
  );
}

export default function SupplyMenu({
  storyId,
  onClose,
}: {
  storyId: number | null;
  onClose: () => void;
}) {
  const [shops, setShops] = useState<Shop[]>([]);
  const [stock, setStock] = useState<Stock>({});
  const [loading, setLoading] = useState(true);
  const [sel, setSel] = useState<string | null>(null); // 열어 둔 점포 key
  const [restocking, setRestocking] = useState(false);
  const [pick, setPick] = useState<BelongingItem | null>(null); // 조달할 물건(인물 고르는 중)
  const [giving, setGiving] = useState(false);
  const { chars } = useCharacters(storyId);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/supply?story_id=${storyId ?? ''}`);
      const data = await res.json();
      setShops(Array.isArray(data.shops) ? data.shops : []);
      setStock(data.stock && typeof data.stock === 'object' ? data.stock : {});
    } catch {
      setShops([]);
      setStock({});
    } finally {
      setLoading(false);
    }
  }, [storyId]);

  useEffect(() => {
    setLoading(true);
    load();
  }, [load]);

  const curShop = shops.find((s) => s.key === sel) || null;
  const curStock = (sel && stock[sel]) || [];

  // 새로 입하 — 그 점포 9점을 새로 지어 교체.
  async function 입하(shopKey: string) {
    if (restocking) return;
    setRestocking(true);
    try {
      const res = await fetch('/api/supply', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ story_id: storyId, shop: shopKey }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        showToast(data.error || '입하하지 못했습니다.');
        return;
      }
      setStock((prev) => ({ ...prev, [shopKey]: Array.isArray(data.stock) ? data.stock : [] }));
    } catch {
      showToast('입하하지 못했습니다.');
    } finally {
      setRestocking(false);
    }
  }

  // 점포 열기 — 진열이 비어 있으면(첫 방문·소진) 자동 입하.
  function openShop(shopKey: string) {
    setSel(shopKey);
    if (!stock[shopKey]?.length) 입하(shopKey);
  }

  // 조달 — 고른 물건을 그 인물 소지품에 보낸다.
  async function 조달(characterId: number, name: string) {
    if (!pick || !sel || giving) return;
    setGiving(true);
    try {
      const res = await fetch('/api/supply', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ story_id: storyId, shop: sel, item_id: pick.id, character_id: characterId }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        showToast(data.error || '조달하지 못했습니다.');
        return;
      }
      setStock((prev) => ({ ...prev, [sel]: Array.isArray(data.stock) ? data.stock : [] }));
      showToast(`${firstName(name)}에게 ${UI.procure}했습니다.`);
      setPick(null);
    } catch {
      showToast('조달하지 못했습니다.');
    } finally {
      setGiving(false);
    }
  }

  return (
    <>
      <Modal
        title={curShop ? curShop.label : '물자 조달'}
        onClose={onClose}
        onBack={curShop ? () => setSel(null) : undefined}
        className="modal--supply"
      >
        {loading ? (
          <Spinner />
        ) : !curShop ? (
          // ── 점포 목록 ──
          <div className="supply-shops">
            {shops.map((s) => (
              <button key={s.key} className="supply-shop" onClick={() => openShop(s.key)}>
                {s.label}
              </button>
            ))}
          </div>
        ) : restocking && !curStock.length ? (
          <div className="supply-empty">
            <Spinner />
          </div>
        ) : (
          // ── 진열 ──
          <>
            {curStock.length ? (
              <div className="supply-grid">
                {curStock.map((it) => (
                  <button key={it.id} className="item-card supply-card" onClick={() => setPick(it)}>
                    <SupplyIcon icon={it.icon} />
                    <div className="item-name">{it.name}</div>
                    <div className="item-divider" />
                    <p className="item-comment">{it.comment}</p>
                  </button>
                ))}
              </div>
            ) : (
              <p className="supply-empty">진열이 비었습니다.</p>
            )}
            <div className="supply-foot">
              <Button variant="secondary" loading={restocking} onClick={() => 입하(sel!)}>
                새로 입하
              </Button>
            </div>
          </>
        )}
      </Modal>

      {pick && (
        <Modal title="누구에게 조달하시겠습니까" onClose={() => setPick(null)} className="modal--list">
          <div className="letter-pick">
            <p className="letter-pick-hint">‘{pick.name}’을(를) 건넬 인물을 고르십시오.</p>
            <ul className="letter-pick-list">
              {chars.map((c) => (
                <li key={c.id}>
                  <button className="letter-pick-row" disabled={giving} onClick={() => 조달(c.id!, c.name)}>
                    <span className="letter-pick-name">{firstName(c.name)}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </Modal>
      )}
    </>
  );
}
