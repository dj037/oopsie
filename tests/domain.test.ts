import test from "node:test";
import assert from "node:assert/strict";
import {
  blankTrip,
  calculatePlan,
  newItem,
  departureCheck,
  duplicateTrip,
  reminderEvents,
  snoozeTrip,
  defaultPreferences,
  itemStats,
  stateSchema,
} from "../shared/domain";
import { applyConstraints, generateDraft } from "../shared/planner";

const now = new Date("2026-11-03T00:00:00.000Z");
test("PRD example computes 07:40 preparation and 08:00 departure in China", () => {
  const t = {
    ...blankTrip(),
    scheduledAt: "2026-11-04T01:00:00.000Z",
    travelMinutes: 40,
  };
  const plan = calculatePlan(t)!;
  assert.equal(
    new Date(plan.departure).toISOString(),
    "2026-11-04T00:00:00.000Z",
  );
  assert.equal(
    new Date(plan.prepare).toISOString(),
    "2026-11-03T23:40:00.000Z",
  );
  assert.equal(
    calculatePlan({ ...t, travelMinutes: 50 })!.departure,
    plan.departure - 600_000,
  );
  assert.equal(calculatePlan({ ...t, travelMinutes: null }), null);
});
test("fixed departure needs no invented commute and supports midnight", () => {
  const p = calculatePlan({
    ...blankTrip(),
    mode: "departure",
    scheduledAt: "2026-11-03T16:10:00.000Z",
    travelMinutes: null,
  })!;
  assert.equal(p.arrival, null);
  assert.equal(new Date(p.prepare).toISOString(), "2026-11-03T15:50:00.000Z");
});
test("natural language resolves tomorrow using caller timezone, not server timezone", () => {
  const { trip } = generateDraft(
    "明天上午 9 点去公司做汇报，从家出发，通勤 40 分钟，需要用自己的电脑",
    defaultPreferences,
    now,
    480,
  );
  assert.equal(trip.scheduledAt, "2026-11-04T01:00:00.000Z");
  assert.equal(trip.travelMinutes, 40);
  assert.equal(trip.scene, "presentation");
  assert.equal(trip.destination, "公司");
  assert.equal(trip.origin, "家");
  assert.ok(trip.items.some((i) => i.name === "电脑充电器"));
  assert.ok(trip.items.every((i) => i.state === "pending"));
});
test("negative instructions suppress computer and exclusively dependent accessories", () => {
  for (const text of [
    "明天9点汇报，不用带电脑",
    "明天9点汇报，现场提供设备",
    "去汇报，不带笔记本电脑",
  ]) {
    const { trip } = generateDraft(text, defaultPreferences, now, 480);
    assert.ok(
      !trip.items.some((i) =>
        ["笔记本电脑", "电脑充电器", "转接头", "翻页器"].includes(i.name),
      ),
      text,
    );
  }
});
test("missing timing leaves a list without fabricated timestamps", () => {
  assert.equal(
    generateDraft("去健身", defaultPreferences, now, 480).trip.scheduledAt,
    null,
  );
  const draft = generateDraft(
    "明天晚上7点去健身房，步行15分钟",
    defaultPreferences,
    now,
    480,
  ).trip;
  assert.equal(draft.scheduledAt, "2026-11-04T11:00:00.000Z");
  assert.equal(draft.transport, "walking");
  assert.equal(draft.travelMinutes, 15);
});
test("dedup keeps separate identity documents, user requirements win", () => {
  const items = applyConstraints(
    [
      newItem("身份证"),
      newItem("护照"),
      newItem("通行证"),
      newItem("电脑"),
      newItem("笔记本电脑"),
    ],
    "",
  );
  assert.equal(items.length, 4);
  assert.ok(items.some((i) => i.name === "护照"));
  const prefs = {
    ...defaultPreferences,
    alwaysItems: [{ id: "a", name: "笔记本电脑", required: false }],
  };
  const trip = generateDraft("明天需要带电脑", prefs, now, 480).trip;
  assert.equal(trip.items.find((i) => i.name === "笔记本电脑")?.required, true);
});
test("departure guard is explicit and overrides retain missing items", () => {
  const trip = {
    ...blankTrip(),
    items: [
      newItem("身份证"),
      { ...newItem("钥匙"), state: "waived" as const },
    ],
  };
  assert.throws(() => departureCheck(trip), /请先确认/);
  const departed = departureCheck(trip, true, now);
  assert.deepEqual(departed.missingAtDeparture, ["身份证"]);
  assert.deepEqual(departed.waivedAtDeparture, ["钥匙"]);
  assert.equal(departed.items[0].state, "pending");
  assert.equal(departed.remindersEnabled, false);
});
test("copies reset item states, time, feedback and reminder identifiers", () => {
  const t = {
    ...blankTrip(),
    items: [{ ...newItem("钥匙"), state: "confirmed" as const }],
    scheduledAt: now.toISOString(),
    remindersEnabled: true,
  };
  const copy = duplicateTrip(t);
  assert.notEqual(copy.id, t.id);
  assert.equal(copy.scheduledAt, null);
  assert.equal(copy.remindersEnabled, false);
  assert.equal(copy.items[0].state, "pending");
  assert.notEqual(copy.items[0].id, t.items[0].id);
});
test("notification plans cancel item nodes after packing and all nodes after departure", () => {
  const trip = {
    ...blankTrip(),
    mode: "departure" as const,
    scheduledAt: new Date(now.getTime() + 3600_000).toISOString(),
    remindersEnabled: true,
    items: [newItem("钥匙")],
  };
  assert.equal(reminderEvents(trip).length, 6);
  const packed = {
    ...trip,
    items: trip.items.map((i) => ({ ...i, state: "confirmed" as const })),
  };
  assert.equal(reminderEvents(packed).length, 4);
  assert.equal(reminderEvents(departureCheck(packed)).length, 0);
  assert.equal(reminderEvents({ ...trip, remindersEnabled: false }).length, 0);
  const edit = {
    ...trip,
    revision: 2,
    scheduledAt: new Date(now.getTime() + 7200_000).toISOString(),
  };
  const old = new Set(reminderEvents(trip).map((r) => r.key));
  assert.ok(reminderEvents(edit).every((r) => !old.has(r.key)));
});
test("merged notification nodes and snooze stay finite", () => {
  const t = {
    ...blankTrip(),
    mode: "departure" as const,
    scheduledAt: new Date(now.getTime() + 600_000).toISOString(),
    prepareMinutes: 10,
    remindersEnabled: true,
    items: [newItem("钥匙")],
  };
  assert.equal(reminderEvents(t).length, 5);
  const once = snoozeTrip(t, now.getTime()),
    twice = snoozeTrip(once, now.getTime() + 1000);
  assert.throws(() => snoozeTrip(twice, now.getTime() + 2000), /已用完/);
  assert.throws(() => snoozeTrip(t, now.getTime() + 30 * 60_000), /已用完/);
  assert.ok(reminderEvents(once).length <= 6);
});
test("zero required items never count as confirmed and data validation rejects invalid times", () => {
  assert.equal(itemStats(blankTrip()).total, 0);
  assert.equal(
    stateSchema.safeParse({
      trips: [{ ...blankTrip(), prepareMinutes: -5 }],
      preferences: defaultPreferences,
    }).success,
    false,
  );
});

test("a timeless checklist has only one explicit reminder and stops when all items are handled", () => {
  const trip = {
    ...blankTrip(),
    remindersEnabled: true,
    checklistReminderAt: "2026-11-04T00:00:00.000Z",
    items: [newItem("水杯", false)],
  };
  assert.equal(calculatePlan(trip), null);
  assert.equal(reminderEvents(trip).length, 1);
  assert.equal(
    reminderEvents({ ...trip, checklistReminderAt: null }).length,
    0,
  );
  assert.equal(
    reminderEvents({
      ...trip,
      items: trip.items.map((i) => ({ ...i, state: "waived" as const })),
    }).length,
    0,
  );
  assert.equal(reminderEvents({ ...trip, status: "cancelled" }).length, 0);
  assert.equal(duplicateTrip(trip).checklistReminderAt, null);
});

test("generic chargers do not duplicate inferred chargers, explicit device chargers remain separate", () => {
  const generic = generateDraft(
    "明天9点去公司汇报，要带电脑和充电器",
    defaultPreferences,
    now,
    480,
  ).trip;
  assert.deepEqual(
    generic.items.filter((i) => i.name.includes("充电器")).map((i) => i.name),
    ["充电器"],
  );
  const explicit = generateDraft(
    "明天9点去公司汇报，要带电脑充电器和手机充电器",
    defaultPreferences,
    now,
    480,
  ).trip;
  assert.equal(
    explicit.items.filter((i) => i.name.includes("充电器")).length,
    2,
  );
});
