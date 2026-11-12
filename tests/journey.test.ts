import test from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";
import { createApp } from "../server/app";
import {
  blankTrip,
  newItem,
  duplicateTrip,
  departureCheck,
  stateSchema,
  emptyData,
} from "../shared/domain";
import { tripReflection, preparationMood } from "../shared/reflection";

test("clock moods change exactly at five minutes and departure; reports only use completed evidence", () => {
  const now = Date.parse("2026-11-04T00:00:00Z");
  assert.equal(preparationMood(now + 300001, now), "relaxed");
  assert.equal(preparationMood(now + 300000, now), "anxious");
  assert.equal(preparationMood(now + 1, now), "anxious");
  assert.equal(preparationMood(now, now), "cooked");
  assert.equal(preparationMood(null, now), "relaxed");
  const base = {
    ...blankTrip(),
    title: "上班",
    mode: "departure" as const,
    scheduledAt: new Date(now).toISOString(),
    items: [newItem("钥匙")],
    preparationStartedAt: new Date(now - 15 * 60000).toISOString(),
  };
  const t = {
    ...departureCheck(base, true, new Date(now + 5 * 60000)),
    status: "completed" as const,
    feedback: {
      missing: true,
      note: "钥匙忘了",
      at: new Date(now + 60 * 60000).toISOString(),
    },
  };
  const r = tripReflection([base, t]);
  assert.equal(r.completed, 1);
  assert.equal(r.onTime, 0);
  assert.equal(r.missing, 1);
  assert.equal(r.averagePreparation, 20);
  assert.ok(r.suggestions.some((s) => s.text.includes("钥匙")));
  assert.equal(duplicateTrip(t).preparationStartedAt, null);
  assert.equal(
    stateSchema.parse({ trips: [], preferences: emptyData().preferences })
      .activeTripId,
    null,
  );
});

test("active trip, profile, completion rewards and redemptions persist with isolation and idempotency", async () => {
  const { app, db } = createApp({ databasePath: ":memory:" });
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>((r) => server.once("listening", r));
  const base = `http://127.0.0.1:${(server.address() as { port: number }).port}/api`;
  const call = async (
    path: string,
    method = "GET",
    body?: unknown,
    cookie = "",
  ) => {
    const r = await fetch(base + path, {
      method,
      headers: {
        "Content-Type": "application/json",
        "X-Oopsie-Client": "1",
        Cookie: cookie,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return {
      status: r.status,
      body: await r.json(),
      cookie: r.headers.get("set-cookie")?.split(";")[0] || "",
    };
  };
  try {
    const a = await call("/auth/register", "POST", {
      name: "旧昵称",
      email: "journey@example.test",
      password: "journey-test-123",
    });
    const b = await call("/auth/register", "POST", {
      name: "其他账号",
      email: "other@example.test",
      password: "journey-test-123",
    });
    assert.equal(a.body.wallet.balance, 0);
    const avatar =
      "data:image/png;base64," +
      (
        await sharp({
          create: { width: 32, height: 32, channels: 3, background: "#fca435" },
        })
          .png()
          .toBuffer()
      ).toString("base64");
    assert.equal(
      (await call("/profile", "PUT", { name: "新昵称", avatar }, a.cookie))
        .status,
      200,
    );
    assert.equal(
      (
        await call(
          "/profile",
          "PUT",
          { name: "新昵称", avatar: "data:image/svg+xml;base64,aaaa" },
          a.cookie,
        )
      ).status,
      400,
    );
    assert.equal(
      (await call("/profile", "PUT", { name: "", avatar: "" }, a.cookie))
        .status,
      400,
    );
    let s = (await call("/session", "GET", undefined, a.cookie)).body;
    assert.equal(s.user.name, "新昵称");
    assert.match(s.user.avatar, /^data:image\/jpeg;base64,/);
    assert.equal(
      (await call("/session", "GET", undefined, b.cookie)).body.user.name,
      "其他账号",
    );
    const first = { ...blankTrip(), title: "明天较早的行程" };
    const selected = {
      ...blankTrip(),
      title: "主动选择的行程",
      items: [newItem("水杯")],
      preparationStartedAt: new Date().toISOString(),
    };
    const data = {
      ...s.data,
      trips: [first, selected],
      activeTripId: selected.id,
    };
    assert.equal(
      (await call("/state", "PUT", { data, baseVersion: s.version }, a.cookie))
        .status,
      200,
    );
    s = (await call("/session", "GET", undefined, a.cookie)).body;
    assert.equal(s.data.activeTripId, selected.id);
    assert.equal(
      (
        await call(
          `/trips/${selected.id}/complete`,
          "POST",
          { baseVersion: s.version, missing: null, note: "" },
          a.cookie,
        )
      ).status,
      422,
    );
    const forged = {
      ...s.data,
      trips: s.data.trips.map((t: any) =>
        t.id === selected.id ? { ...t, status: "completed" } : t,
      ),
      activeTripId: null,
    };
    assert.equal(
      (
        await call(
          "/state",
          "PUT",
          { data: forged, baseVersion: s.version },
          a.cookie,
        )
      ).status,
      422,
    );
    for (const id of [selected.id, first.id]) {
      s = (await call("/session", "GET", undefined, a.cookie)).body;
      const next = {
        ...s.data,
        trips: s.data.trips.map((t: any) =>
          t.id === id ? departureCheck(t, true) : t,
        ),
      };
      assert.equal(
        (
          await call(
            "/state",
            "PUT",
            { data: next, baseVersion: s.version },
            a.cookie,
          )
        ).status,
        200,
      );
      assert.equal(
        (
          await call(
            `/trips/${id}/complete`,
            "POST",
            { baseVersion: s.version, missing: false, note: "" },
            a.cookie,
          )
        ).status,
        409,
      );
      const payload = { baseVersion: s.version + 1, missing: false, note: "" };
      const responses = await Promise.all([
        call(`/trips/${id}/complete`, "POST", payload, a.cookie),
        call(`/trips/${id}/complete`, "POST", payload, a.cookie),
      ]);
      assert.deepEqual(
        responses.map((r) => r.status),
        [200, 200],
      );
      assert.equal(
        responses.reduce((n, r) => n + r.body.awarded, 0),
        1,
      );
    }
    s = (await call("/session", "GET", undefined, a.cookie)).body;
    assert.equal(s.wallet.balance, 2);
    assert.equal(s.data.activeTripId, null);
    assert.equal(
      (
        await call(
          `/trips/${selected.id}/complete`,
          "POST",
          { baseVersion: 1, missing: false, note: "" },
          b.cookie,
        )
      ).status,
      404,
    );
    // Reach the 20-point sticker price through real one-point completions.
    const extra = Array.from({ length: 18 }, (_, i) =>
      departureCheck({ ...blankTrip(), title: `积分行程 ${i + 3}` }, true),
    );
    assert.equal(
      (
        await call(
          "/state",
          "PUT",
          {
            data: { ...s.data, trips: [...s.data.trips, ...extra] },
            baseVersion: s.version,
          },
          a.cookie,
        )
      ).status,
      200,
    );
    for (const trip of extra) {
      s = (await call("/session", "GET", undefined, a.cookie)).body;
      const result = await call(
        `/trips/${trip.id}/complete`,
        "POST",
        {
          baseVersion: s.version,
          missing: false,
          note: "",
        },
        a.cookie,
      );
      assert.equal(result.status, 200);
      assert.equal(result.body.awarded, 1);
    }
    s = (await call("/session", "GET", undefined, a.cookie)).body;
    assert.equal(s.wallet.balance, 20);
    assert.equal(s.wallet.completedCount, 20);
    const requestId = crypto.randomUUID();
    const exchanges = await Promise.all([
      call(
        "/redemptions",
        "POST",
        { productId: "stickers", requestId },
        a.cookie,
      ),
      call(
        "/redemptions",
        "POST",
        { productId: "stickers", requestId },
        a.cookie,
      ),
    ]);
    assert.ok(
      exchanges.every(
        (r) =>
          r.status === 200 &&
          r.body.balance === 0 &&
          r.body.redemptions.length === 1,
      ),
    );
    assert.equal(
      (
        await call(
          "/redemptions",
          "POST",
          { productId: "phone-grip", requestId },
          a.cookie,
        )
      ).status,
      409,
    );
    assert.equal(
      (
        await call(
          "/redemptions",
          "POST",
          { productId: "stickers", requestId: crypto.randomUUID() },
          a.cookie,
        )
      ).status,
      422,
    );
    assert.equal(
      (
        await call(
          "/redemptions",
          "POST",
          { productId: "stickers", requestId: crypto.randomUUID() },
          b.cookie,
        )
      ).status,
      422,
    );
    assert.equal((await call("/rewards")).status, 401);
    s = (await call("/session", "GET", undefined, a.cookie)).body;
    const reopened = {
      ...s.data,
      trips: s.data.trips.map((t: any) =>
        t.id === selected.id ? { ...t, status: "departed" } : t,
      ),
    };
    await call(
      "/state",
      "PUT",
      { data: reopened, baseVersion: s.version },
      a.cookie,
    );
    const repeat = await call(
      `/trips/${selected.id}/complete`,
      "POST",
      { baseVersion: s.version + 1, missing: false, note: "" },
      a.cookie,
    );
    assert.equal(repeat.body.awarded, 0);
    assert.equal(repeat.body.wallet.balance, 0);
    assert.equal(
      (await call("/rewards", "GET", undefined, a.cookie)).body.redemptions
        .length,
      1,
    );
  } finally {
    await new Promise<void>((r) => server.close(() => r()));
    db.close();
  }
});
