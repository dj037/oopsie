import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { api, ApiError, type Snapshot, type User } from "./api";
import { emptyWallet, type Wallet } from "../../shared/rewards";
import {
  emptyData,
  stateSchema,
  type AppData,
  type Trip,
  type Preferences,
  type Item,
} from "../../shared/domain";

type SyncState = "saved" | "saving" | "offline" | "conflict" | "error";
type Store = {
  user: User | null;
  loading: boolean;
  data: AppData;
  wallet: Wallet;
  updateProfile: (name: string, avatar: string) => Promise<void>;
  startPreparation: (id: string) => void;
  completeTrip: (
    id: string,
    missing: boolean | null,
    note: string,
  ) => Promise<number>;
  redeem: (productId: string, requestId: string) => Promise<void>;
  refreshWallet: () => Promise<void>;
  aiEnabled: boolean;
  sync: SyncState;
  error: string;
  authenticate: (snapshot: Snapshot) => void;
  logout: () => Promise<void>;
  saveTrip: (trip: Trip) => void;
  confirmScannedItem: (
    tripId: string,
    itemId: string,
    verification: NonNullable<Item["verification"]>,
  ) => void;
  removeTrip: (id: string) => void;
  setPreferences: (preferences: Preferences) => void;
  clearData: () => void;
  retry: () => Promise<void>;
  reload: () => Promise<void>;
};
const Context: ReturnType<typeof createContext<Store | null>> =
  import.meta.hot?.data.oopsieContext ?? createContext<Store | null>(null);
if (import.meta.hot) import.meta.hot.data.oopsieContext = Context;
const cacheKey = (id: string) => `oopsie:data:${id}`;
type Cache = { data: AppData; version: number; pending: boolean };
function readCache(id: string): Cache | null {
  try {
    const c = JSON.parse(localStorage.getItem(cacheKey(id)) || "null");
    if (c && stateSchema.safeParse(c.data).success) return c;
  } catch {}
  return null;
}
export function StoreProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null),
    [loading, setLoading] = useState(true),
    [data, setData] = useState<AppData>(emptyData);
  const [aiEnabled, setAI] = useState(false),
    [sync, setSync] = useState<SyncState>("saved"),
    [error, setError] = useState("");
  const [wallet, setWallet] = useState<Wallet>(emptyWallet);
  const remoteBusy = useRef(false);
  const current = useRef({
    user: null as User | null,
    data: emptyData(),
    version: 1,
    dirty: false,
  });
  const running = useRef<Promise<void> | null>(null);
  const persist = useCallback(() => {
    const s = current.current;
    if (!s.user) return;
    try {
      localStorage.setItem(
        cacheKey(s.user.id),
        JSON.stringify({ data: s.data, version: s.version, pending: s.dirty }),
      );
    } catch {
      setError("本机储存空间不足，请及时同步或清理历史行程");
    }
  }, []);
  const drain = useCallback(async () => {
    if (running.current) return running.current;
    if (!navigator.onLine) {
      setSync("offline");
      setError("离线使用中，修改已保存在本机，联网后同步");
      persist();
      return;
    }
    const task = async () => {
      while (current.current.dirty && current.current.user) {
        const userId = current.current.user.id,
          snapshot = current.current.data,
          version = current.current.version;
        current.current.dirty = false;
        setSync("saving");
        try {
          const result = await api.save(snapshot, version);
          if (current.current.user?.id !== userId) return;
          current.current.version = result.version;
          persist();
          if (!current.current.dirty) {
            setSync("saved");
            setError("");
          }
        } catch (e) {
          current.current.dirty = true;
          persist();
          setSync(
            e instanceof ApiError && e.status === 409
              ? "conflict"
              : !navigator.onLine
                ? "offline"
                : "error",
          );
          setError(
            e instanceof Error ? e.message : "暂时无法同步，修改已保存在本机",
          );
          break;
        }
      }
    };
    running.current = task();
    try {
      await running.current;
    } finally {
      running.current = null;
    }
  }, [persist]);
  const authenticate = useCallback(
    (snapshot: Snapshot) => {
      const cache = readCache(snapshot.user.id);
      const useLocal = !!cache?.pending;
      current.current = {
        user: snapshot.user,
        data: stateSchema.parse(useLocal ? cache!.data : snapshot.data),
        version: useLocal ? cache!.version : snapshot.version,
        dirty: useLocal,
      };
      setUser(snapshot.user);
      setData(current.current.data);
      setAI(snapshot.aiEnabled);
      setWallet(snapshot.wallet || emptyWallet());
      localStorage.setItem(
        `oopsie:wallet:${snapshot.user.id}`,
        JSON.stringify(snapshot.wallet || emptyWallet()),
      );
      setError("");
      setSync(useLocal ? "saving" : "saved");
      localStorage.setItem(
        "oopsie:session",
        JSON.stringify({ user: snapshot.user, verifiedAt: Date.now() }),
      );
      persist();
      if (useLocal) void drain();
    },
    [drain, persist],
  );
  useEffect(() => {
    let active = true;
    const init = async () => {
      try {
        if (localStorage.getItem("oopsie:pending-logout")) {
          await api.logout();
          localStorage.removeItem("oopsie:pending-logout");
        }
        const snapshot = await api.session();
        if (active) authenticate(snapshot);
      } catch (e) {
        if (!active) return;
        if (e instanceof ApiError && e.status === 401) {
          localStorage.removeItem("oopsie:session");
        } else if (!localStorage.getItem("oopsie:pending-logout")) {
          try {
            const session = JSON.parse(
              localStorage.getItem("oopsie:session") || "null",
            );
            const cache = session && readCache(session.user.id);
            if (cache && session.verifiedAt > Date.now() - 7 * 86400_000) {
              current.current = {
                user: session.user,
                data: stateSchema.parse(cache.data),
                version: cache.version,
                dirty: cache.pending,
              };
              setUser(session.user);
              setWallet(
                JSON.parse(
                  localStorage.getItem(`oopsie:wallet:${session.user.id}`) ||
                    "null",
                ) || emptyWallet(),
              );
              setData(current.current.data);
              setSync("offline");
              setError("离线使用中，修改会保存在本机，联网后同步");
            }
          } catch {}
        }
      } finally {
        if (active) setLoading(false);
      }
    };
    void init();
    return () => {
      active = false;
    };
  }, [authenticate]);
  useEffect(() => {
    const online = () => {
      if (current.current.dirty) void drain();
    };
    window.addEventListener("online", online);
    return () => window.removeEventListener("online", online);
  }, [drain]);
  const change = useCallback(
    (fn: (value: AppData) => AppData) => {
      if (!current.current.user) return;
      if (remoteBusy.current) throw new Error("正在结算行程，请稍后操作");
      const next = fn(current.current.data);
      stateSchema.parse(next);
      current.current.data = next;
      current.current.dirty = true;
      setData(next);
      persist();
      void drain();
    },
    [persist, drain],
  );
  const saveTrip = useCallback(
    (trip: Trip) =>
      change((d) => ({
        ...d,
        activeTripId:
          d.activeTripId === trip.id &&
          ["cancelled", "completed"].includes(trip.status)
            ? null
            : d.activeTripId,
        trips: d.trips.some((t) => t.id === trip.id)
          ? d.trips.map((t) => (t.id === trip.id ? trip : t))
          : [trip, ...d.trips],
      })),
    [change],
  );
  const logout = async () => {
    await drain();
    if (current.current.dirty)
      throw new Error("还有未同步的修改，请先同步或重新载入后再退出");
    await api.logout();
    current.current = {
      user: null,
      data: emptyData(),
      version: 1,
      dirty: false,
    };
    localStorage.removeItem("oopsie:session");
    setUser(null);
    setData(emptyData());
    setWallet(emptyWallet());
    setError("");
    setSync("saved");
  };
  const reload = async () => {
    const s = await api.session();
    if (current.current.user)
      localStorage.setItem(
        `oopsie:recovery:${current.current.user.id}`,
        JSON.stringify(current.current.data),
      );
    localStorage.removeItem(cacheKey(s.user.id));
    authenticate(s);
  };
  return (
    <Context.Provider
      value={{
        user,
        loading,
        data,
        wallet,
        updateProfile: async (name, avatar) => {
          const { user: updated } = await api.updateProfile(name, avatar);
          current.current.user = updated;
          setUser(updated);
          localStorage.setItem(
            "oopsie:session",
            JSON.stringify({ user: updated, verifiedAt: Date.now() }),
          );
        },
        startPreparation: (id) =>
          change((d) => {
            const trip = d.trips.find((t) => t.id === id);
            if (!trip || !["planned", "departed"].includes(trip.status))
              throw new Error("请选择尚未完成的行程");
            return {
              ...d,
              activeTripId: id,
              trips: d.trips.map((t) =>
                t.id === id
                  ? {
                      ...t,
                      preparationStartedAt:
                        t.preparationStartedAt || new Date().toISOString(),
                    }
                  : t,
              ),
            };
          }),
        completeTrip: async (id, missing, note) => {
          if (remoteBusy.current) throw new Error("正在结算，请勿重复提交");
          await drain();
          if (current.current.dirty)
            throw new Error("请先同步行程，再完成并领取积分");
          remoteBusy.current = true;
          try {
            const result = await api.complete(
              id,
              current.current.version,
              missing,
              note,
            );
            authenticate(result);
            return result.awarded;
          } finally {
            remoteBusy.current = false;
          }
        },
        redeem: async (productId, requestId) => {
          const next = await api.redeem(productId, requestId);
          setWallet(next);
          if (current.current.user)
            localStorage.setItem(
              `oopsie:wallet:${current.current.user.id}`,
              JSON.stringify(next),
            );
        },
        refreshWallet: async () => {
          const next = await api.rewards();
          setWallet(next);
        },
        aiEnabled,
        sync,
        error,
        authenticate,
        logout,
        saveTrip,
        confirmScannedItem: (tripId, itemId, verification) =>
          change((d) => {
            const trip = d.trips.find((t) => t.id === tripId);
            if (!trip || trip.status !== "planned")
              throw new Error("行程状态已改变，请重新打开清单");
            return {
              ...d,
              trips: d.trips.map((t) =>
                t.id !== tripId
                  ? t
                  : {
                      ...t,
                      updatedAt: new Date().toISOString(),
                      items: t.items.map((i) =>
                        i.id !== itemId
                          ? i
                          : {
                              ...i,
                              state: "confirmed",
                              confirmedAt: verification.at,
                              waivedReason: "",
                              verification,
                            },
                      ),
                    },
              ),
            };
          }),
        removeTrip: (id) =>
          change((d) => ({
            ...d,
            activeTripId: d.activeTripId === id ? null : d.activeTripId,
            trips: d.trips.filter((t) => t.id !== id),
          })),
        setPreferences: (p) => change((d) => ({ ...d, preferences: p })),
        clearData: () => change(() => emptyData()),
        retry: drain,
        reload,
      }}
    >
      {children}
    </Context.Provider>
  );
}
export function useStore() {
  const ctx = useContext(Context);
  if (!ctx) throw new Error("Store not mounted");
  return ctx;
}
