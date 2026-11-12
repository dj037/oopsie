import test from "node:test";
import assert from "node:assert/strict";
import { createApp } from "../server/app";
import { blankTrip, newItem } from "../shared/domain";

test("real accounts validate passwords, isolate data, persist sessions, and reject stale writes", async () => {
  const { app, db } = createApp({ databasePath: ":memory:" });
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>((r) => server.once("listening", r));
  const address = server.address() as { port: number };
  const base = `http://127.0.0.1:${address.port}`;
  async function call(
    path: string,
    method = "GET",
    body?: unknown,
    cookie = "",
  ) {
    const response = await fetch(base + "/api" + path, {
      method,
      headers: {
        "Content-Type": "application/json",
        "X-Oopsie-Client": "1",
        Cookie: cookie,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return {
      status: response.status,
      body: await response.json(),
      cookie: response.headers.get("set-cookie")?.split(";")[0] || "",
    };
  }
  try {
    assert.equal((await call("/session")).status, 401);
    const a = await call("/auth/register", "POST", {
      name: "测试用户甲",
      email: "A@example.test",
      password: "test-pass-123",
    });
    assert.equal(a.status, 200);
    assert.ok(a.cookie.startsWith("oopsie_session="));
    const row = db
      .prepare("SELECT password_hash,password_salt FROM users")
      .get() as { password_hash: string; password_salt: string };
    assert.notEqual(row.password_hash, "test-pass-123");
    assert.equal(row.password_salt.length, 32);
    assert.equal(
      (
        await call("/auth/register", "POST", {
          name: "甲",
          email: "a@example.test",
          password: "test-pass-123",
        })
      ).status,
      409,
    );
    assert.equal(
      (
        await call("/auth/login", "POST", {
          email: "a@example.test",
          password: "wrong-password",
        })
      ).status,
      401,
    );
    assert.equal(
      (
        await call("/auth/login", "POST", {
          email: "a@example.test",
          password: "test-pass-123",
        })
      ).status,
      200,
    );
    const payload = {
      ...a.body.data,
      trips: [{ ...blankTrip(), title: "甲的面试", items: [newItem("简历")] }],
    };
    assert.equal(
      (await call("/state", "PUT", { data: payload, baseVersion: 1 }, a.cookie))
        .status,
      200,
    );
    assert.equal(
      (await call("/state", "PUT", { data: payload, baseVersion: 1 }, a.cookie))
        .status,
      409,
    );
    assert.equal(
      (await call("/session", "GET", undefined, a.cookie)).body.data.trips[0]
        .title,
      "甲的面试",
    );
    const b = await call("/auth/register", "POST", {
      name: "测试用户乙",
      email: "b@example.test",
      password: "test-pass-456",
    });
    assert.equal(b.body.data.trips.length, 0);
    assert.equal(
      (await call("/session", "GET", undefined, b.cookie)).body.data.trips
        .length,
      0,
    );
    const draft = await call(
      "/planning-drafts",
      "POST",
      {
        text: "明天9点面试，不用带电脑",
        now: "2026-11-03T00:00:00.000Z",
        offset: 480,
      },
      a.cookie,
    );
    assert.equal(draft.status, 200);
    assert.equal(draft.body.trip.generation, "rules");
    const csrf = await fetch(base + "/api/state", {
      method: "PUT",
      headers: { "Content-Type": "application/json", Cookie: a.cookie },
      body: JSON.stringify({ data: payload, baseVersion: 2 }),
    });
    assert.equal(csrf.status, 403);
    const badOrigin = await fetch(base + "/api/auth/logout", {
      method: "POST",
      headers: {
        Origin: "https://evil.example",
        "X-Oopsie-Client": "1",
        Cookie: a.cookie,
      },
    });
    assert.equal(badOrigin.status, 403);
    await call("/auth/logout", "POST", {}, a.cookie);
    assert.equal(
      (await call("/session", "GET", undefined, a.cookie)).status,
      401,
    );
  } finally {
    await new Promise<void>((r) => server.close(() => r()));
    db.close();
  }
});
