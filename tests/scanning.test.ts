import test from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";
import { createApp } from "../server/app";
import { localTarget } from "../server/vision";
import { blankTrip, newItem, duplicateTrip } from "../shared/domain";

test("scan label matching handles accessories before devices and rejects unknown objects", () => {
  assert.equal(
    localTarget("电脑充电器"),
    "electric power adapter and charging cable",
  );
  assert.equal(localTarget("手机数据线"), "USB cable");
  assert.equal(localTarget("平板电脑"), "tablet computer");
  assert.equal(localTarget("笔记本电脑"), "laptop computer");
  assert.equal(localTarget("太阳镜"), "sunglasses");
  assert.equal(localTarget("未经命名的特殊设备"), undefined);
});

test("server requires an account-scoped matching photo receipt for every new confirmation", async () => {
  let matches = false;
  const { app, db } = createApp({
    databasePath: ":memory:",
    recognizer: async () => ({
      matched: matches,
      label: "keys on a key ring",
      engine: "local-clip",
      message: matches ? "通过" : "不匹配",
    }),
  });
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>((r) => server.once("listening", r));
  const base = `http://127.0.0.1:${(server.address() as { port: number }).port}/api`;
  const call = async (
    path: string,
    method = "GET",
    body?: unknown,
    cookie = "",
  ) => {
    const response = await fetch(base + path, {
      method,
      headers: {
        "Content-Type": "application/json",
        "X-Oopsie-Client": "1",
        Cookie: cookie,
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    return {
      status: response.status,
      body: await response.json(),
      cookie: response.headers.get("set-cookie")?.split(";")[0] || "",
    };
  };
  try {
    const a = await call("/auth/register", "POST", {
      name: "扫描甲",
      email: "scan-a@example.test",
      password: "strong-test-pass",
    });
    const b = await call("/auth/register", "POST", {
      name: "扫描乙",
      email: "scan-b@example.test",
      password: "strong-test-pass",
    });
    const trip = {
      ...blankTrip(),
      title: "去公司",
      items: [newItem("钥匙"), newItem("水杯")],
    };
    const data = { ...a.body.data, trips: [trip] };
    assert.equal(
      (await call("/state", "PUT", { data, baseVersion: 1 }, a.cookie)).status,
      200,
    );
    const forged = structuredClone(data);
    forged.trips[0].items[0].state = "confirmed";
    assert.equal(
      (await call("/state", "PUT", { data: forged, baseVersion: 2 }, a.cookie))
        .status,
      422,
    );
    const photo =
      "data:image/jpeg;base64," +
      (
        await sharp({
          create: { width: 200, height: 200, channels: 3, background: "white" },
        })
          .jpeg()
          .toBuffer()
      ).toString("base64");
    const request = { tripId: trip.id, itemId: trip.items[0].id, photo };
    assert.equal(
      (await call("/item-scans", "POST", request, b.cookie)).status,
      404,
    );
    assert.equal((await call("/item-scans", "POST", request)).status, 401);
    assert.equal(
      (
        await call(
          "/item-scans",
          "POST",
          { ...request, photo: "data:image/jpeg;base64,bm90YW5pbWFnZQ==" },
          a.cookie,
        )
      ).status,
      400,
    );
    const denied = await call("/item-scans", "POST", request, a.cookie);
    assert.equal(denied.body.matched, false);
    assert.equal(denied.body.verification, null);
    assert.equal(
      (
        db.prepare("SELECT count(*) AS n FROM scan_receipts").get() as {
          n: number;
        }
      ).n,
      0,
    );
    matches = true;
    const passed = await call("/item-scans", "POST", request, a.cookie);
    assert.equal(passed.body.matched, true);
    const confirmed = structuredClone(data);
    confirmed.trips[0].items[0] = {
      ...confirmed.trips[0].items[0],
      state: "confirmed",
      confirmedAt: passed.body.verification.at,
      verification: passed.body.verification,
    };
    const wrongItem = structuredClone(confirmed);
    wrongItem.trips[0].items[1] = {
      ...wrongItem.trips[0].items[1],
      state: "confirmed",
      verification: passed.body.verification,
    };
    assert.equal(
      (
        await call(
          "/state",
          "PUT",
          { data: wrongItem, baseVersion: 2 },
          a.cookie,
        )
      ).status,
      422,
    );
    const renamed = structuredClone(confirmed);
    renamed.trips[0].items[0].name = "身份证";
    assert.equal(
      (await call("/state", "PUT", { data: renamed, baseVersion: 2 }, a.cookie))
        .status,
      422,
    );
    assert.equal(
      (
        await call(
          "/state",
          "PUT",
          { data: confirmed, baseVersion: 2 },
          a.cookie,
        )
      ).status,
      200,
    );
    const persisted = (await call("/session", "GET", undefined, a.cookie)).body
      .data.trips[0].items[0];
    assert.equal(persisted.state, "confirmed");
    assert.equal(persisted.verification.id, passed.body.verification.id);
    assert.equal(duplicateTrip(confirmed.trips[0]).items[0].verification, null);
    assert.equal(
      (
        await call(
          "/state",
          "PUT",
          { data: confirmed, baseVersion: 3 },
          b.cookie,
        )
      ).status,
      422,
    );
  } finally {
    await new Promise<void>((r) => server.close(() => r()));
    db.close();
  }
});
