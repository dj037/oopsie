type Activity = { id: number; label: string; startedAt: number };
let pending: readonly Activity[] = [];
let sequence = 0;
const listeners = new Set<() => void>();
const labels: Record<string, string> = {
  "/session": "正在整理你的出发计划…",
  "/auth/login": "正在登录，马上就好…",
  "/auth/register": "正在准备你的出发空间…",
  "/auth/logout": "正在退出登录…",
  "/planning-drafts": "正在整理你的行程和物品…",
  "/item-scans": "小龙虾正在认真辨认物品…",
  "/state": "正在保存你的准备进度…",
  "/profile": "正在保存个人资料…",
  "/rewards": "正在更新你的积分…",
  "/redemptions": "正在兑换这份小奖励…",
};
export const getNetworkActivity = () => pending;
export const subscribeNetworkActivity = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};
export function beginNetworkActivity(path: string) {
  const id = ++sequence;
  pending = [
    ...pending,
    {
      id,
      startedAt: Date.now(),
      label:
        labels[path] ||
        (path.endsWith("/complete")
          ? "正在记录这次出发…"
          : "稍等一下，马上就好…"),
    },
  ];
  listeners.forEach((listener) => listener());
  let finished = false;
  return () => {
    if (finished) return;
    finished = true;
    pending = pending.filter((item) => item.id !== id);
    listeners.forEach((listener) => listener());
  };
}
