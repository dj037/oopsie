import { useEffect, useState } from "react";
import { useStore } from "../lib/store";
import { rewardProducts, COMPLETION_POINTS } from "../../shared/rewards";
import { Button, Modal, PageTitle, Icon, dateText } from "./ui";
export function Shop({ notify }: { notify: (s: string) => void }) {
  const { wallet, redeem, refreshWallet } = useStore();
  const [selection, setSelection] = useState<{
      productId: string;
      requestId: string;
    } | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  useEffect(() => {
    void refreshWallet().catch(() =>
      setError("暂时无法刷新积分，联网后再兑换。"),
    );
  }, []);
  const product = rewardProducts.find((p) => p.id === selection?.productId);
  async function confirm() {
    if (!product || !selection) return;
    setBusy(true);
    setError("");
    try {
      await redeem(product.id, selection.requestId);
      setSelection(null);
      notify("兑换成功，已扣除积分并生成兑换记录");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="shop-page">
      <PageTitle title="积分兑换小铺" english="Good habits, little rewards" />
      <section className="points-hero">
        <div>
          <span>可用积分</span>
          <strong>
            {wallet.balance}
            <small>分</small>
          </strong>
        </div>
        <Icon name="shop" size={40} />
        <p>每完成一条行程 +{COMPLETION_POINTS} 分，让准备变成好习惯。</p>
      </section>
      {error && !selection && (
        <p className="error-box" role="alert">
          {error}
        </p>
      )}
      <h2 className="shop-section-heading">
        挑一份出发奖励
        <small className="title-english">The Oopsie collection</small>
      </h2>
      <div className="rewards-grid">
        {rewardProducts.map((p) => (
          <article key={p.id}>
            <img src={p.image} alt={p.name} />
            <div>
              <h3>{p.name}</h3>
              <small>{p.english}</small>
              <strong className="product-cost">{p.cost} 积分</strong>
              <Button
                disabled={wallet.balance < p.cost}
                onClick={() => {
                  setError("");
                  setSelection({
                    productId: p.id,
                    requestId: crypto.randomUUID(),
                  });
                }}
              >
                {wallet.balance < p.cost
                  ? `还差 ${p.cost - wallet.balance} 分`
                  : "兑换这个奖励"}
              </Button>
            </div>
          </article>
        ))}
      </div>
      <p className="redemption-note">
        当前可兑换并生成记录；实物领取、库存和配送服务尚未接入，兑换不会自动发货。
      </p>
      <section className="redemption-history">
        <h2>
          我的兑换记录
          <small className="title-english">Redemption history</small>
        </h2>
        {wallet.redemptions.length ? (
          wallet.redemptions.map((r) => (
            <article key={r.id}>
              <Icon name="shop" size={20} />
              <div>
                <strong>{r.name}</strong>
                <small>
                  {dateText(r.at)} · -{r.cost} 分
                </small>
                <p>待安排实物领取 · 兑换号 {r.id.slice(0, 8)}</p>
              </div>
            </article>
          ))
        ) : (
          <p className="fine-print">还没有兑换记录，完成行程后再来看看。</p>
        )}
      </section>
      {product && (
        <Modal
          title="确认兑换奖励"
          subtitle="Redeem your reward"
          onClose={() => !busy && setSelection(null)}
          footer={
            <>
              <Button
                variant="secondary"
                disabled={busy}
                onClick={() => setSelection(null)}
              >
                再想想
              </Button>
              <Button
                disabled={busy || wallet.balance < product.cost}
                onClick={() => void confirm()}
              >
                {busy ? "正在兑换…" : `使用 ${product.cost} 积分兑换`}
              </Button>
            </>
          }
        >
          <img
            className="product-detail-image"
            src={product.image}
            alt={product.name}
          />
          <h3>{product.name}</h3>
          <p>
            兑换后余额为 {wallet.balance - product.cost}{" "}
            分。本次将扣除积分、保存兑换记录；实物配送尚未开放。
          </p>
          {error && (
            <p className="error-box" role="alert">
              {error}
            </p>
          )}
        </Modal>
      )}
    </div>
  );
}
