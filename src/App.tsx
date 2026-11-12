import { useCallback, useEffect, useRef, useState } from "react";
import { useStore } from "./lib/store";
import { ScanItem } from "./components/ScanItem";
import { Shop } from "./components/Shop";
import { Auth } from "./components/Auth";
import { Dashboard } from "./components/Dashboard";
import { Trips } from "./components/Trips";
import { Profile } from "./components/Profile";
import { Composer } from "./components/Composer";
import { TripDetail } from "./components/TripDetail";
import {
  Icon,
  IconButton,
  Button,
  Modal,
  Confirm,
  dateText,
  Avatar,
  type IconName,
} from "./components/ui";
import {
  reminderEvents,
  snoozeTrip,
  itemStats,
  calculatePlan,
  type Trip,
  type ReminderEvent,
} from "../shared/domain";
import {
  browserNotice,
  cancelAllNotifications,
  initializeNotificationActions,
  notificationStatus,
  reconcileNative,
  isNative,
  enableAudio,
  type NoticeStatus,
} from "./lib/notifications";

type Page = "home" | "clock" | "profile" | "shop";
export default function App() {
  const {
    user,
    loading,
    data,
    sync,
    error,
    retry,
    reload,
    saveTrip,
    startPreparation,
  } = useStore();
  const [page, setPage] = useState<Page>(
    location.hash === "#clock"
      ? "clock"
      : location.hash === "#profile"
        ? "profile"
        : location.hash === "#shop"
          ? "shop"
          : "home",
  );
  const [composer, setComposer] = useState<{
      initial?: Trip;
      text?: string;
    } | null>(null),
    [detail, setDetail] = useState<string | null>(null),
    [toast, setToast] = useState(""),
    [now, setNow] = useState(Date.now());
  const [noticeStatus, setNoticeStatus] = useState<NoticeStatus>("prompt"),
    [reminders, setReminders] = useState<ReminderEvent[]>([]),
    [reloadConfirm, setReloadConfirm] = useState(false);
  const [drawer, setDrawer] = useState(false);
  const [scan, setScan] = useState<{ tripId: string; itemId: string } | null>(
    null,
  );
  const latest = useRef({ data, user });
  latest.current = { data, user };
  const notify = useCallback((message: string) => setToast(message), []);
  useEffect(() => {
    if (!toast) return;
    const timeout = setTimeout(() => setToast(""), 5000);
    return () => clearTimeout(timeout);
  }, [toast]);
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const refreshNotice = useCallback(() => {
    void notificationStatus().then(setNoticeStatus);
  }, []);
  useEffect(() => {
    refreshNotice();
    const onFocus = () => refreshNotice();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [refreshNotice]);
  useEffect(() => {
    const change = () => {
      if (location.hash === "#clock") setPage("clock");
      else if (location.hash === "#profile") setPage("profile");
      else if (location.hash === "#shop") setPage("shop");
      else setPage("home");
    };
    window.addEventListener("hashchange", change);
    return () => window.removeEventListener("hashchange", change);
  }, []);
  useEffect(() => {
    if (loading) return;
    if (!user) {
      setReminders([]);
      void cancelAllNotifications();
      return;
    }
    const handle = setTimeout(() => {
      void reconcileNative(data.trips, data.preferences)
        .then((r) => setNoticeStatus(r.status))
        .catch(() => {
          setNoticeStatus("failed");
          notify("计划已保存，但系统提醒安排失败，请在设置中检查权限");
        });
    }, 300);
    return () => clearTimeout(handle);
  }, [data, user, loading, notify]);
  useEffect(() => {
    setDetail(null);
    setScan(null);
    setDrawer(false);
    setComposer(null);
    setReloadConfirm(false);
  }, [user?.id]);
  useEffect(() => {
    if (!user) return;
    let cleanup: (() => void) | undefined,
      disposed = false;
    void initializeNotificationActions(
      (id) => setDetail(id),
      (id) => {
        const trip = latest.current.data.trips.find((t) => t.id === id);
        if (trip)
          try {
            saveTrip(snoozeTrip(trip));
            notify("5 分钟后再次提醒");
          } catch (e) {
            notify((e as Error).message);
          }
      },
    ).then((fn) => {
      if (disposed) fn();
      else cleanup = fn;
    });
    return () => {
      disposed = true;
      cleanup?.();
    };
  }, [user, saveTrip, notify]);
  useEffect(() => {
    if (!user) return;
    const key = `oopsie:seen-reminders:${user.id}`;
    let seen = new Set<string>();
    try {
      seen = new Set(JSON.parse(localStorage.getItem(key) || "[]"));
    } catch {}
    const tick = () => {
      const { data, currentUser } = {
        data: latest.current.data,
        currentUser: latest.current.user,
      };
      if (!currentUser || currentUser.id !== user.id) return;
      const time = Date.now(),
        due: ReminderEvent[] = [];
      for (const trip of data.trips) {
        const events = reminderEvents(trip).filter(
          (n) => n.at <= time && !seen.has(n.key),
        );
        for (const e of events) seen.add(e.key);
        const recent = events.filter((e) => e.at > time - 60_000);
        if (recent.length) due.push(recent.at(-1)!);
      }
      if (due.length) {
        localStorage.setItem(key, JSON.stringify([...seen].slice(-500)));
        setReminders((previous) => [...previous, ...due].slice(0, 5));
        if (!isNative) void browserNotice(due[0], data.preferences);
      }
    };
    tick();
    const timer = setInterval(tick, 5000);
    return () => clearInterval(timer);
  }, [user]);
  // A confirmed/cancelled trip must also dismiss an already visible reminder.
  useEffect(() => {
    setReminders((list) =>
      list.filter((r) =>
        data.trips.some(
          (t) =>
            t.id === r.tripId &&
            t.status === "planned" &&
            t.remindersEnabled &&
            (r.kind !== "check" ||
              (calculatePlan(t)
                ? itemStats(t).pending.length > 0
                : t.items.some((i) => i.state === "pending"))),
        ),
      ),
    );
  }, [data]);
  function go(next: Page) {
    setPage(next);
    setDrawer(false);
    location.hash = next;
    window.scrollTo({ top: 0, behavior: "instant" });
  }
  const openCreate = (text = "") => {
    enableAudio();
    setComposer({ text });
  };
  const openDetail = (id: string) => {
    enableAudio();
    setDetail(id);
  };
  if (loading)
    return (
      <div className="loading-screen">
        <span className="topbar-brand">Oopsie Adults</span>
      </div>
    );
  if (!user)
    return (
      <>
        <Auth />
        {toast && (
          <div className="toast" role="status">
            {toast}
          </div>
        )}
      </>
    );
  const nav: { id: Page; label: string; icon: IconName }[] = [
    { id: "home", label: "首页", icon: "calendar" },
    { id: "clock", label: "时钟", icon: "alarm" },
    { id: "shop", label: "周边", icon: "shop" },
  ];
  const reminder = reminders[0];
  return (
    <div className={`app-shell reference-app page-${page}`}>
      <header className="reference-topbar">
        <button
          className="profile-trigger"
          aria-label="打开个人菜单"
          onClick={() => setDrawer(true)}
        >
          <Avatar name={user.name} src={user.avatar} />
        </button>
        <span className="topbar-brand">Oopsie Adults</span>
        <span
          className={`sync-status ${sync}`}
          title={error || "账号数据已保存"}
        >
          {sync === "saved" ? (
            <Icon name="cloud" size={13} />
          ) : (
            <Icon name="offline" size={13} />
          )}
        </span>
        <IconButton
          name="settings"
          label="设置"
          onClick={() => go("profile")}
        />
      </header>
      <main className="reference-main">
        {sync !== "saved" && sync !== "saving" && (
          <div className="sync-banner">
            <Icon name="offline" size={16} />
            <span>{error || "修改暂存在本机"}</span>
            <button
              onClick={() =>
                sync === "conflict" ? setReloadConfirm(true) : void retry()
              }
            >
              {sync === "conflict" ? "重新载入" : "重新同步"}
            </button>
          </div>
        )}
        {page === "clock" ? (
          <Dashboard
            now={now}
            onOpen={openDetail}
            onTrips={() => go("home")}
            onScan={(tripId, itemId) => setScan({ tripId, itemId })}
          />
        ) : page === "home" ? (
          <Trips onCreate={openCreate} onOpen={openDetail} />
        ) : page === "shop" ? (
          <Shop notify={notify} />
        ) : (
          <Profile
            status={noticeStatus}
            onRefresh={refreshNotice}
            notify={notify}
            onShop={() => go("shop")}
          />
        )}
      </main>
      <nav className="pill-nav" aria-label="主导航">
        {nav.map((n) => (
          <button
            key={n.id}
            aria-label={n.label}
            aria-current={page === n.id ? "page" : undefined}
            className={page === n.id ? "active" : ""}
            onClick={() => go(n.id)}
          >
            <Icon name={n.icon} size={24} />
          </button>
        ))}
      </nav>
      {drawer && (
        <div className="drawer-scrim" onClick={() => setDrawer(false)}>
          <aside
            className="profile-drawer"
            onClick={(e) => e.stopPropagation()}
            aria-label="个人菜单"
          >
            <IconButton
              name="x"
              label="关闭菜单"
              onClick={() => setDrawer(false)}
            />
            <h2>
              我的出发空间<small>My Oopsie</small>
            </h2>
            <Avatar
              name={user.name}
              src={user.avatar}
              className="drawer-avatar"
            />
            <strong>{user.name}</strong>
            <small>{user.email}</small>
            <button onClick={() => go("profile")}>
              <Icon name="user" />
              我的资料 <span>Personal profile</span>
            </button>
            <button onClick={() => go("home")}>
              <Icon name="calendar" />
              我的行程 <span>My schedule</span>
            </button>
            <button onClick={() => go("profile")}>
              <Icon name="backpack" />
              常带物品 <span>Everyday essentials</span>
            </button>
            <button onClick={() => go("profile")}>
              <Icon name="volume" />
              提醒设置 <span>Reminder settings</span>
            </button>
            <img src="/assets/mascot.png" alt="" />
          </aside>
        </div>
      )}
      {composer && (
        <Composer
          initial={composer.initial}
          initialText={composer.text}
          onClose={() => setComposer(null)}
          onSaved={(id) => {
            setComposer(null);
            setDetail(id);
          }}
          notify={notify}
        />
      )}
      {detail && !composer && !scan && (
        <TripDetail
          id={detail}
          preparationReview={page !== "clock"}
          onStart={() => {
            try {
              startPreparation(detail);
              setDetail(null);
              go("clock");
              notify("已开始准备，时钟将持续跟随这条行程");
            } catch (e) {
              notify((e as Error).message);
            }
          }}
          onClose={() => setDetail(null)}
          onEdit={(trip) => {
            setDetail(null);
            setComposer({ initial: trip });
          }}
          notify={notify}
          onScan={(tripId, itemId) => setScan({ tripId, itemId })}
        />
      )}
      {scan && (
        <ScanItem
          tripId={scan.tripId}
          itemId={scan.itemId}
          onClose={() => setScan(null)}
          notify={notify}
        />
      )}
      {reminder && !composer && !detail && !scan && (
        <Modal
          title={reminder.title}
          eyebrow="OOPSIE HAS YOUR BACK"
          onClose={() => setReminders((r) => r.slice(1))}
          footer={
            <>
              {data.trips.some(
                (t) => t.id === reminder.tripId && calculatePlan(t),
              ) && (
                <Button
                  variant="secondary"
                  onClick={() => {
                    const t = data.trips.find((t) => t.id === reminder.tripId);
                    if (t)
                      try {
                        saveTrip(snoozeTrip(t));
                        setReminders((r) => r.slice(1));
                        notify("5 分钟后提醒你");
                      } catch (e) {
                        notify((e as Error).message);
                      }
                  }}
                >
                  5 分钟后提醒
                </Button>
              )}
              <Button
                icon="backpack"
                onClick={() => {
                  openDetail(reminder.tripId);
                  setReminders((r) => r.slice(1));
                }}
              >
                查看清单
              </Button>
            </>
          }
        >
          <div className="reminder-content">
            <img src="/assets/mascot.png" alt="" />
            <p>{data.trips.find((t) => t.id === reminder.tripId)?.title}</p>
            <strong>{reminder.body}</strong>
            <small>关闭这条提示不会自动确认携带或出发。</small>
          </div>
        </Modal>
      )}
      {reloadConfirm && (
        <Confirm
          title="载入服务中的最新数据？"
          description="另一个窗口已经更新了数据。本机尚未同步的版本会保留为恢复备份，界面将切换到服务中的最新版本。"
          confirmText="载入最新版本"
          onClose={() => setReloadConfirm(false)}
          onConfirm={() => {
            void reload()
              .then(() => {
                setReloadConfirm(false);
                notify("已载入最新数据");
              })
              .catch((e) => notify(e.message));
          }}
        />
      )}
      {toast && (
        <div className="toast" role="status">
          <Icon name="success" size={18} />
          {toast}
          <button aria-label="关闭提示" onClick={() => setToast("")}>
            <Icon name="x" size={14} />
          </button>
        </div>
      )}
    </div>
  );
}
