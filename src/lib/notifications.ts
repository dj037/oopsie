import { Capacitor } from "@capacitor/core";
import { LocalNotifications } from "@capacitor/local-notifications";
import {
  calculatePlan,
  reminderEvents,
  type Trip,
  type Preferences,
  type ReminderEvent,
} from "../../shared/domain";

export const isNative = Capacitor.isNativePlatform();
export type NoticeStatus =
  "native-ready" | "web-ready" | "denied" | "prompt" | "unsupported" | "failed";
export async function notificationStatus(): Promise<NoticeStatus> {
  try {
    if (isNative) {
      const p = await LocalNotifications.checkPermissions();
      return p.display === "granted"
        ? "native-ready"
        : p.display === "denied"
          ? "denied"
          : "prompt";
    }
    if (!("Notification" in window)) return "unsupported";
    return Notification.permission === "granted"
      ? "web-ready"
      : Notification.permission === "denied"
        ? "denied"
        : "prompt";
  } catch {
    return "failed";
  }
}
export async function requestNotifications(): Promise<NoticeStatus> {
  if (isNative) await LocalNotifications.requestPermissions();
  else if ("Notification" in window) await Notification.requestPermission();
  return notificationStatus();
}
const numberId = (key: string) => {
  let hash = 0;
  for (const c of key) hash = (Math.imul(hash, 31) + c.charCodeAt(0)) | 0;
  return Math.abs(hash) || 1;
};
let nativeQueue: Promise<unknown> = Promise.resolve();
export function reconcileNative(
  trips: Trip[],
  preferences: Preferences,
): Promise<{ count: number; status: NoticeStatus }> {
  const task = async () => {
    const status = await notificationStatus();
    if (!isNative) return { count: 0, status };
    const pending = await LocalNotifications.getPending();
    if (pending.notifications.length)
      await LocalNotifications.cancel({
        notifications: pending.notifications.map((n) => ({ id: n.id })),
      });
    const delivered = await LocalNotifications.getDeliveredNotifications();
    if (delivered.notifications.length)
      await LocalNotifications.removeDeliveredNotifications({
        notifications: delivered.notifications,
      });
    if (status !== "native-ready") return { count: 0, status };
    const nextEvent = (t: Trip) =>
      reminderEvents(t).find((n) => n.at > Date.now() + 1000)?.at ?? Infinity;
    const selected = trips
      .filter((t) => Number.isFinite(nextEvent(t)))
      .sort((a, b) => nextEvent(a) - nextEvent(b))
      .slice(0, 5);
    const events = selected
      .flatMap(reminderEvents)
      .filter((n) => n.at > Date.now() + 1000)
      .slice(0, 48);
    // Each write is serialized, so rapid confirmation/edit operations cannot leave stale requests.
    if (events.length)
      await LocalNotifications.schedule({
        notifications: events.map((n) => ({
          id: numberId(n.key),
          title: n.title,
          body: preferences.privateNotifications
            ? "打开 Oopsie 查看本次出发准备。"
            : n.body,
          schedule: { at: new Date(n.at) },
          sound: preferences.sound ? "default" : undefined,
          extra: { tripId: n.tripId, key: n.key },
          actionTypeId: selected.some(
            (trip) => trip.id === n.tripId && calculatePlan(trip),
          )
            ? "OOPSIE_CHECK"
            : "OOPSIE_CHECK_ONCE",
        })),
      });
    return { count: events.length, status };
  };
  const result = nativeQueue.then(task, task);
  nativeQueue = result.catch(() => {});
  return result;
}
export async function cancelAllNotifications() {
  if (!isNative) return;
  await nativeQueue;
  const pending = await LocalNotifications.getPending();
  if (pending.notifications.length)
    await LocalNotifications.cancel({
      notifications: pending.notifications.map((n) => ({ id: n.id })),
    });
  await LocalNotifications.removeAllDeliveredNotifications();
}
export async function initializeNotificationActions(
  onOpen: (tripId: string) => void,
  onSnooze: (tripId: string) => void,
) {
  if (!isNative) return () => {};
  await LocalNotifications.registerActionTypes({
    types: [
      {
        id: "OOPSIE_CHECK",
        actions: [
          { id: "open", title: "查看清单", foreground: true },
          { id: "snooze", title: "稍后提醒", foreground: true },
        ],
      },
      {
        id: "OOPSIE_CHECK_ONCE",
        actions: [{ id: "open", title: "查看清单", foreground: true }],
      },
    ],
  });
  const listener = await LocalNotifications.addListener(
    "localNotificationActionPerformed",
    (event) => {
      const id = event.notification.extra?.tripId;
      if (id) {
        if (event.actionId === "snooze") onSnooze(id);
        else onOpen(id);
      }
    },
  );
  return () => {
    void listener.remove();
  };
}
let audio: AudioContext | null = null;
export function enableAudio() {
  try {
    audio ??= new AudioContext();
    void audio.resume();
  } catch {}
}
export function playChime(tone: "a" | "b" | "c" = "a") {
  try {
    if (!audio || audio.state !== "running") return;
    const start = audio.currentTime;
    ({ a: [660, 880, 660], b: [523, 659, 784], c: [880, 660, 440] })[
      tone
    ].forEach((freq, i) => {
      const osc = audio!.createOscillator(),
        gain = audio!.createGain();
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0, start + i * 0.2);
      gain.gain.linearRampToValueAtTime(0.12, start + i * 0.2 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, start + i * 0.2 + 0.18);
      osc.connect(gain);
      gain.connect(audio!.destination);
      osc.start(start + i * 0.2);
      osc.stop(start + i * 0.2 + 0.2);
    });
  } catch {}
}
export async function browserNotice(
  event: ReminderEvent,
  preferences: Preferences,
) {
  if (preferences.sound) playChime(preferences.tone);
  if (navigator.vibrate) navigator.vibrate([180, 80, 180]);
  if (
    !isNative &&
    "Notification" in window &&
    Notification.permission === "granted"
  ) {
    const options = {
      body: preferences.privateNotifications
        ? "打开 Oopsie 查看本次出发准备。"
        : event.body,
      icon: "/assets/icon-192.png",
      tag: event.key,
    };
    try {
      const reg = await navigator.serviceWorker?.getRegistration();
      if (reg) await reg.showNotification(event.title, options);
      else new Notification(event.title, options);
    } catch {
      /* The visible in-app reminder remains available. */
    }
  }
}
export async function testNotification(preferences: Preferences) {
  enableAudio();
  if (preferences.sound) playChime(preferences.tone);
  const status = await notificationStatus();
  if (isNative && status === "native-ready") {
    await LocalNotifications.schedule({
      notifications: [
        {
          id: 2147483000,
          title: "Oopsie 提醒测试",
          body: "准备好了吗？这是一条测试提醒。",
          schedule: { at: new Date(Date.now() + 5000) },
        },
      ],
    });
    return "5 秒后将发送系统测试通知";
  }
  if (status === "web-ready")
    await browserNotice(
      {
        key: "test",
        tripId: "",
        at: Date.now(),
        kind: "check",
        title: "Oopsie 提醒测试",
        body: "准备好了吗？这是一条测试提醒。",
      },
      preferences,
    );
  return "测试完成。网页版提醒需要保持页面打开";
}
