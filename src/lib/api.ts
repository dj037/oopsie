import type { AppData, Trip, Item } from "../../shared/domain";
import type { Wallet } from "../../shared/rewards";
import { beginNetworkActivity } from "./networkActivity";
export type User = { id: string; name: string; email: string; avatar?: string };
export type Snapshot = {
  user: User;
  data: AppData;
  version: number;
  aiEnabled: boolean;
  wallet: Wallet;
};
export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}
const base = (import.meta.env.VITE_API_BASE || "").replace(/\/$/, "");
export async function request<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  if (!navigator.onLine) throw new Error("当前离线，修改将保存在本机");
  const finish = beginNetworkActivity(path);
  try {
    const response = await fetch(base + "/api" + path, {
      ...options,
      signal:
        options.signal ??
        AbortSignal.timeout(path === "/session" ? 60_000 : 30_000),
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        "X-Oopsie-Client": "1",
        ...options.headers,
      },
    });
    const data = await response
      .json()
      .catch(() => ({ error: "服务暂时不可用" }));
    if (!response.ok)
      throw new ApiError(data.error || "请求未完成", response.status);
    return data as T;
  } finally {
    finish();
  }
}
export const api = {
  updateProfile: (name: string, avatar: string) =>
    request<{ user: User }>("/profile", {
      method: "PUT",
      body: JSON.stringify({ name, avatar }),
    }),
  rewards: () => request<Wallet>("/rewards"),
  redeem: (productId: string, requestId: string) =>
    request<Wallet>("/redemptions", {
      method: "POST",
      body: JSON.stringify({ productId, requestId }),
    }),
  complete: (
    id: string,
    baseVersion: number,
    missing: boolean | null,
    note: string,
  ) =>
    request<Snapshot & { awarded: number }>(
      `/trips/${encodeURIComponent(id)}/complete`,
      { method: "POST", body: JSON.stringify({ baseVersion, missing, note }) },
    ),
  session: () => request<Snapshot>("/session"),
  login: (email: string, password: string) =>
    request<Snapshot>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),
  register: (name: string, email: string, password: string) =>
    request<Snapshot>("/auth/register", {
      method: "POST",
      body: JSON.stringify({ name, email, password }),
    }),
  logout: () => request<{ ok: boolean }>("/auth/logout", { method: "POST" }),
  visionStatus: () =>
    request<{ available: boolean; mode: "local-clip" | "vision-api" }>(
      "/vision-status",
    ),
  save: (data: AppData, baseVersion: number) =>
    request<{ version: number }>("/state", {
      method: "PUT",
      body: JSON.stringify({ data, baseVersion }),
    }),
  scan: (tripId: string, itemId: string, photo: string, signal?: AbortSignal) =>
    request<{
      matched: boolean;
      message: string;
      verification: Item["verification"];
    }>("/item-scans", {
      method: "POST",
      signal,
      body: JSON.stringify({ tripId, itemId, photo }),
    }),
  draft: (text: string, signal?: AbortSignal) =>
    request<{ trip: Trip; notices: string[] }>("/planning-drafts", {
      method: "POST",
      signal,
      body: JSON.stringify({
        text,
        now: new Date().toISOString(),
        offset: -new Date().getTimezoneOffset(),
      }),
    }),
};
