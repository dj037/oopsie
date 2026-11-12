import { z } from "zod";

const id = z.string().min(1).max(100);
const timestamp = z.string().datetime().nullable();
export const itemSchema = z.object({
  id,
  name: z.string().min(1).max(80),
  quantity: z.number().int().min(1).max(99),
  required: z.boolean(),
  state: z.enum(["pending", "confirmed", "waived"]),
  category: z.string().max(30),
  reason: z.string().max(300),
  source: z.enum(["template", "personal", "user", "ai"]),
  confirmedAt: timestamp,
  waivedReason: z.string().max(200).default(""),
  verification: z
    .object({
      id: z.string().uuid(),
      at: z.string().datetime(),
      label: z.string().max(80),
      engine: z.enum(["local-clip", "vision-api"]),
    })
    .nullable()
    .default(null),
});
export type Item = z.infer<typeof itemSchema>;
export const tripSchema = z.object({
  id,
  title: z.string().min(1).max(80),
  scene: z.string().max(30),
  description: z.string().max(2000),
  destination: z.string().max(200),
  origin: z.string().max(200),
  transport: z.enum(["transit", "driving", "walking", "cycling", "taxi"]),
  mode: z.enum(["arrival", "departure"]),
  scheduledAt: timestamp,
  timezone: z.string().max(80),
  travelMinutes: z.number().int().min(0).max(2880).nullable(),
  prepareMinutes: z.number().int().min(0).max(1440),
  bufferMinutes: z.number().int().min(0).max(240),
  leadMinutes: z.number().int().min(0).max(240),
  items: z.array(itemSchema).max(100),
  status: z.enum(["planned", "departed", "completed", "cancelled"]),
  revision: z.number().int().min(1),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  departedAt: timestamp,
  preparationStartedAt: timestamp.default(null),
  missingAtDeparture: z.array(z.string().max(80)).max(100),
  waivedAtDeparture: z.array(z.string().max(80)).max(100),
  remindersEnabled: z.boolean(),
  checklistReminderAt: timestamp.default(null),
  snoozeCount: z.number().int().min(0).max(2),
  snoozeUntil: timestamp,
  snoozedAt: timestamp,
  stepsDone: z.array(z.string().max(60)).max(20),
  feedback: z
    .object({
      missing: z.boolean().nullable(),
      note: z.string().max(500),
      at: z.string().datetime(),
    })
    .nullable(),
  generation: z.enum(["rules", "ai", "manual"]),
});
export type Trip = z.infer<typeof tripSchema>;
export const preferencesSchema = z.object({
  prepareMinutes: z.number().int().min(0).max(1440),
  bufferMinutes: z.number().int().min(0).max(240),
  leadMinutes: z.number().int().min(0).max(240),
  home: z.string().max(200),
  sound: z.boolean(),
  tone: z.enum(["a", "b", "c"]).default("a"),
  privateNotifications: z.boolean(),
  alwaysItems: z
    .array(
      z.object({ id, name: z.string().min(1).max(80), required: z.boolean() }),
    )
    .max(30),
});
export type Preferences = z.infer<typeof preferencesSchema>;
export const stateSchema = z.object({
  trips: z.array(tripSchema).max(300),
  preferences: preferencesSchema,
  activeTripId: id.nullable().default(null),
});
export type AppData = z.infer<typeof stateSchema>;
export const defaultPreferences: Preferences = {
  prepareMinutes: 20,
  bufferMinutes: 10,
  leadMinutes: 10,
  home: "",
  sound: true,
  tone: "a",
  privateNotifications: true,
  alwaysItems: [],
};
export const emptyData = (): AppData => ({
  trips: [],
  preferences: structuredClone(defaultPreferences),
  activeTripId: null,
});
export const newId = () => crypto.randomUUID();

export const scenes = [
  {
    id: "work",
    label: "日常通勤",
    short: "通勤",
    icon: "briefcase",
    prompt: "明天早上 9 点去公司上班，坐地铁，通勤 40 分钟",
  },
  {
    id: "presentation",
    label: "汇报会议",
    short: "汇报",
    icon: "presentation",
    prompt:
      "明天上午 9 点去公司做方案汇报，从家出发，地铁通勤 40 分钟，需要用自己的电脑",
  },
  {
    id: "study",
    label: "上课考试",
    short: "考试",
    icon: "graduation",
    prompt: "明天上午 9 点去学校参加考试，公交 30 分钟",
  },
  {
    id: "gym",
    label: "运动健身",
    short: "健身",
    icon: "dumbbell",
    prompt: "今天晚上 7 点去健身房运动，步行 15 分钟",
  },
  {
    id: "travel",
    label: "短途出行",
    short: "旅行",
    icon: "luggage",
    prompt: "后天早上 8 点出发去杭州短途旅行，坐高铁，通勤 60 分钟",
  },
  {
    id: "interview",
    label: "面试赴约",
    short: "面试",
    icon: "users",
    prompt: "明天下午 2 点去公司面试，打车 30 分钟",
  },
] as const;
export const transportLabels: Record<Trip["transport"], string> = {
  transit: "公共交通",
  driving: "自驾",
  walking: "步行",
  cycling: "骑行",
  taxi: "打车",
};
export const sceneLabel = (scene: string) =>
  scenes.find((s) => s.id === scene)?.label || "日常外出";

export function blankTrip(
  preferences = defaultPreferences,
  now = new Date(),
): Trip {
  return {
    id: newId(),
    title: "",
    scene: "general",
    description: "",
    destination: "",
    origin: preferences.home,
    transport: "transit",
    mode: "arrival",
    scheduledAt: null,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    travelMinutes: null,
    prepareMinutes: preferences.prepareMinutes,
    bufferMinutes: preferences.bufferMinutes,
    leadMinutes: preferences.leadMinutes,
    items: [],
    status: "planned",
    revision: 1,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
    departedAt: null,
    preparationStartedAt: null,
    missingAtDeparture: [],
    waivedAtDeparture: [],
    remindersEnabled: false,
    checklistReminderAt: null,
    snoozeCount: 0,
    snoozeUntil: null,
    snoozedAt: null,
    stepsDone: [],
    feedback: null,
    generation: "manual",
  };
}

export function newItem(
  name: string,
  required = true,
  source: Item["source"] = "user",
  reason = "由你添加",
): Item {
  return {
    id: newId(),
    name,
    required,
    source,
    quantity: 1,
    state: "pending",
    category: "随身物品",
    reason,
    confirmedAt: null,
    waivedReason: "",
    verification: null,
  };
}

export function calculatePlan(trip: Trip) {
  if (!trip.scheduledAt) return null;
  const time = new Date(trip.scheduledAt).getTime();
  if (!Number.isFinite(time)) return null;
  if (trip.mode === "arrival" && trip.travelMinutes === null) return null;
  const departure =
    trip.mode === "departure"
      ? time
      : time -
        (trip.leadMinutes + trip.bufferMinutes + trip.travelMinutes!) * 60_000;
  const prepare = departure - trip.prepareMinutes * 60_000;
  const arrival =
    trip.travelMinutes === null
      ? null
      : departure + trip.travelMinutes * 60_000;
  return {
    departure,
    prepare,
    arrival,
    targetArrival:
      trip.mode === "arrival" ? time - trip.leadMinutes * 60_000 : null,
    event: trip.mode === "arrival" ? time : null,
  };
}

export function itemStats(trip: Trip) {
  const required = trip.items.filter((i) => i.required);
  return {
    total: required.length,
    confirmed: required.filter((i) => i.state === "confirmed").length,
    waived: required.filter((i) => i.state === "waived").length,
    pending: required.filter((i) => i.state === "pending"),
  };
}
export function isExpired(trip: Trip, now = Date.now()) {
  return (
    trip.status === "planned" &&
    !!trip.scheduledAt &&
    now > new Date(trip.scheduledAt).getTime() + 2 * 3600_000
  );
}
export function departureCheck(
  trip: Trip,
  override = false,
  now = new Date(),
): Trip {
  if (trip.status !== "planned") throw new Error("当前行程不在待出发状态");
  const stats = itemStats(trip);
  if (stats.pending.length && !override) throw new Error("请先确认必带物品");
  return {
    ...trip,
    status: "departed",
    departedAt: now.toISOString(),
    updatedAt: now.toISOString(),
    missingAtDeparture: stats.pending.map((i) => i.name),
    waivedAtDeparture: trip.items
      .filter((i) => i.required && i.state === "waived")
      .map((i) => i.name),
    remindersEnabled: false,
    snoozeUntil: null,
    revision: trip.revision + 1,
  };
}
export function duplicateTrip(trip: Trip, now = new Date()): Trip {
  return {
    ...trip,
    id: newId(),
    title: `${trip.title}（副本）`.slice(0, 80),
    status: "planned",
    scheduledAt: null,
    items: trip.items.map((i) => ({
      ...i,
      id: newId(),
      state: "pending",
      confirmedAt: null,
      waivedReason: "",
      verification: null,
    })),
    revision: 1,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
    departedAt: null,
    preparationStartedAt: null,
    missingAtDeparture: [],
    waivedAtDeparture: [],
    remindersEnabled: false,
    checklistReminderAt: null,
    snoozeCount: 0,
    snoozeUntil: null,
    snoozedAt: null,
    stepsDone: [],
    feedback: null,
  };
}

export type ReminderEvent = {
  key: string;
  tripId: string;
  at: number;
  kind: "prepare" | "check" | "departure" | "followup" | "snooze";
  title: string;
  body: string;
};
export function reminderEvents(trip: Trip): ReminderEvent[] {
  const plan = calculatePlan(trip);
  if (trip.status !== "planned" || !trip.remindersEnabled) return [];
  if (!plan) {
    if (
      !trip.checklistReminderAt ||
      !trip.items.some((i) => i.state === "pending")
    )
      return [];
    const at = Date.parse(trip.checklistReminderAt);
    return [
      {
        key: `${trip.id}:${trip.revision}:checklist:${at}`,
        tripId: trip.id,
        at,
        kind: "check",
        title: "检查一下你的随身物品",
        body: `「${trip.title}」还有物品待检查。这是你设置的一次性提醒。`,
      },
    ];
  }
  const pending = itemStats(trip).pending.length > 0;
  const nodes: {
    at: number;
    kind: ReminderEvent["kind"];
    title: string;
    body: string;
  }[] = [
    {
      at: plan.prepare,
      kind: "prepare",
      title: "可以开始准备了",
      body: `为「${trip.title}」留一点从容的时间。`,
    },
    ...(pending
      ? [-10, -5].map((m) => ({
          at: plan.departure + m * 60_000,
          kind: "check" as const,
          title: "出发前，再检查一下",
          body: "必带物品还有未确认项，打开清单检查。",
        }))
      : []),
    {
      at: plan.departure,
      kind: "departure",
      title: "到计划出发时间了",
      body: `「${trip.title}」准备好就出发吧。`,
    },
    ...[5, 10].map((m) => ({
      at: plan.departure + m * 60_000,
      kind: "followup" as const,
      title: m === 10 ? "最后一次出发提醒" : "还没有收到出发确认",
      body: "打开清单，确认物品和本次出发。",
    })),
  ];
  const effective = nodes.filter(
    (n) =>
      !(
        trip.snoozeUntil &&
        trip.snoozedAt &&
        n.kind === "check" &&
        n.at >= Date.parse(trip.snoozedAt) &&
        n.at <= Date.parse(trip.snoozeUntil)
      ),
  );
  if (trip.snoozeUntil)
    effective.push({
      at: Date.parse(trip.snoozeUntil),
      kind: "snooze",
      title: "再检查一下出发准备",
      body: "这是你设置的稍后提醒。",
    });
  const rank = { prepare: 0, check: 1, snooze: 2, followup: 3, departure: 4 };
  const merged: typeof nodes = [];
  for (const n of effective.sort((a, b) => a.at - b.at)) {
    const last = merged.at(-1);
    if (last && n.at - last.at < 60_000) {
      if (rank[n.kind] >= rank[last.kind]) merged[merged.length - 1] = n;
    } else merged.push(n);
  }
  return merged.map((n) => ({
    ...n,
    tripId: trip.id,
    key: `${trip.id}:${trip.revision}:${n.kind}:${n.at}`,
  }));
}
export function snoozeTrip(trip: Trip, now = Date.now()): Trip {
  const plan = calculatePlan(trip);
  if (
    !plan ||
    trip.snoozeCount >= 2 ||
    now + 300_000 > plan.departure + 900_000 ||
    trip.status !== "planned"
  )
    throw new Error("本次稍后提醒已用完，请调整出发时间");
  return {
    ...trip,
    snoozeCount: trip.snoozeCount + 1,
    snoozedAt: new Date(now).toISOString(),
    snoozeUntil: new Date(now + 300_000).toISOString(),
  };
}

export function timeline(trip: Trip) {
  const plan = calculatePlan(trip);
  if (!plan) return [];
  const prep =
    trip.scene === "presentation"
      ? "检查演示文件与设备"
      : trip.scene === "gym"
        ? "换好衣服，整理运动包"
        : "整理资料与随身物品";
  return [
    {
      id: "prepare",
      title: prep,
      at: plan.prepare,
      description: `预留 ${trip.prepareMinutes} 分钟准备`,
    },
    {
      id: "pack",
      title: "逐项确认必带物品",
      at: plan.prepare + (plan.departure - plan.prepare) / 2,
      description: "拍摄物品，识别通过后放进包里",
    },
    {
      id: "check",
      title: "出发前最后检查",
      at: Math.max(plan.prepare, plan.departure - 300_000),
      description: "钥匙、证件，还有场景专属物品",
    },
    {
      id: "depart",
      title: "从容出发",
      at: plan.departure,
      description: `${transportLabels[trip.transport]}${trip.travelMinutes !== null ? ` · 预计 ${trip.travelMinutes} 分钟` : ""}`,
    },
    ...(plan.arrival === null
      ? []
      : [
          {
            id: "arrive",
            title: "预计到达",
            at: plan.arrival,
            description: "按你填写的通勤用时估计",
          },
        ]),
  ].sort((a, b) => a.at - b.at);
}

export function mapUrl(trip: Trip) {
  const url = new URL("https://maps.apple.com/");
  url.searchParams.set("daddr", trip.destination);
  if (trip.origin) url.searchParams.set("saddr", trip.origin);
  url.searchParams.set(
    "dirflg",
    trip.transport === "walking"
      ? "w"
      : trip.transport === "transit"
        ? "r"
        : "d",
  );
  return url.toString();
}
