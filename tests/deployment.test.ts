import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createApp } from "../server/app";

test("cloud proxy origin, secure login cookies and configured database survive a process restart", async () => {
  const folder = await mkdtemp(join(tmpdir(), "oopsie-deploy-"));
  const keys = [
    "DATABASE_PATH",
    "RENDER_EXTERNAL_URL",
    "COOKIE_SECURE",
  ] as const;
  const old = Object.fromEntries(keys.map((k) => [k, process.env[k]]));
  process.env.DATABASE_PATH = join(folder, "persistent", "accounts.sqlite");
  process.env.RENDER_EXTERNAL_URL = "https://oopsie-test.onrender.com";
  process.env.COOKIE_SECURE = "true";
  let current: ReturnType<typeof createApp> | undefined;
  let server:
    ReturnType<ReturnType<typeof createApp>["app"]["listen"]> | undefined;
  const start = async () => {
    current = createApp();
    server = current.app.listen(0, "127.0.0.1");
    await new Promise<void>((done) => server!.once("listening", done));
    return `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  };
  const stop = async () => {
    if (server)
      await new Promise<void>((done, reject) =>
        server!.close((e) => (e ? reject(e) : done())),
      );
    server = undefined;
    current?.db.close();
    current = undefined;
  };
  try {
    let base = await start();
    const headers = {
      "Content-Type": "application/json",
      "X-Oopsie-Client": "1",
      Origin: "https://oopsie-test.onrender.com",
    };
    const registration = await fetch(base + "/api/auth/register", {
      method: "POST",
      headers,
      body: JSON.stringify({
        name: "线上体验",
        email: "cloud@example.test",
        password: "cloud-demo-pass",
      }),
    });
    assert.equal(registration.status, 200);
    const cookie = registration.headers.get("set-cookie")!;
    assert.match(cookie, /HttpOnly/);
    assert.match(cookie, /Secure/);
    const user = (await registration.json()).user;
    assert.equal(
      (
        await fetch(base + "/api/session", {
          headers: {
            ...headers,
            Origin: "https://unrelated.example",
            Cookie: cookie.split(";")[0],
          },
        })
      ).status,
      403,
    );
    await stop();
    base = await start();
    const session = await fetch(base + "/api/session", {
      headers: { ...headers, Cookie: cookie.split(";")[0] },
    });
    assert.equal(session.status, 200);
    assert.equal((await session.json()).user.id, user.id);
  } finally {
    await stop();
    for (const key of keys)
      if (old[key] === undefined) delete process.env[key];
      else process.env[key] = old[key];
    await rm(folder, { recursive: true, force: true });
  }
});
