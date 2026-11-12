import { mkdir, writeFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { build } from "vite";

const configuredOrigin = process.env.OOPSIE_API_ORIGIN;
if (!configuredOrigin)
  throw new Error(
    "Set OOPSIE_API_ORIGIN to the HTTPS origin of the Oopsie API before building for Netlify.",
  );

let apiOrigin;
try {
  const url = new URL(configuredOrigin);
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.pathname !== "/" ||
    url.search ||
    url.hash
  )
    throw new Error();
  apiOrigin = url.origin;
} catch {
  throw new Error(
    "OOPSIE_API_ORIGIN must be a plain HTTPS origin, such as https://oopsie-api.example.com.",
  );
}

execFileSync(
  process.execPath,
  [resolve("node_modules/typescript/bin/tsc"), "--noEmit"],
  { stdio: "inherit" },
);
await build();
const dist = resolve("dist");
await mkdir(dist, { recursive: true });
await writeFile(
  resolve(dist, "_redirects"),
  `/api/* ${apiOrigin}/api/:splat 200\n/* /index.html 200\n`,
);
console.log(`Netlify build ready; /api requests proxy to ${apiOrigin}.`);
