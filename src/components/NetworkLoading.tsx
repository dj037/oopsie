import {
  useEffect,
  useState,
  useSyncExternalStore,
  type CSSProperties,
} from "react";
import {
  getNetworkActivity,
  subscribeNetworkActivity,
} from "../lib/networkActivity";

export function NetworkLoading() {
  const pending = useSyncExternalStore(
    subscribeNetworkActivity,
    getNetworkActivity,
  );
  const first = pending[0];
  const [phase, setPhase] = useState<"hidden" | "waiting" | "slow">("hidden");
  useEffect(() => {
    if (!first) {
      setPhase("hidden");
      return;
    }
    const elapsed = Date.now() - first.startedAt;
    setPhase(elapsed >= 8000 ? "slow" : elapsed >= 700 ? "waiting" : "hidden");
    const show = window.setTimeout(
      () => setPhase("waiting"),
      Math.max(0, 700 - elapsed),
    );
    const slow = window.setTimeout(
      () => setPhase("slow"),
      Math.max(0, 8000 - elapsed),
    );
    return () => {
      window.clearTimeout(show);
      window.clearTimeout(slow);
    };
  }, [first?.id, first?.startedAt]);
  if (!first || phase === "hidden") return null;
  return (
    <div
      className="network-loading"
      role="status"
      aria-live="polite"
      aria-label={first.label}
    >
      <div className="network-loading-content">
        <div className="lobster-loader-art" aria-hidden="true">
          <div className="lobster-loader-rays">
            {Array.from({ length: 12 }, (_, i) => (
              <i key={i} style={{ "--ray": i } as CSSProperties} />
            ))}
          </div>
          <img
            src="/assets/lobster-loading.png"
            width="260"
            height="260"
            alt=""
            draggable={false}
          />
        </div>
        <p>{first.label}</p>
        <small>
          {phase === "slow"
            ? "这次有点慢，小龙虾还在努力加载"
            : "小龙虾陪你等一小会儿"}
        </small>
      </div>
    </div>
  );
}
