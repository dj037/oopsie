import { existsSync } from "node:fs";
import { createApp } from "./app";

if (existsSync(".env")) process.loadEnvFile(".env");
const { app, db } = createApp();
const port = Number(process.env.PORT || 8787),
  host = process.env.HOST || "127.0.0.1";
const server = app.listen(port, host, () =>
  console.log(`Oopsie API · http://${host}:${port}`),
);
for (const signal of ["SIGTERM", "SIGINT"])
  process.on(signal, () =>
    server.close(() => {
      db.close();
      process.exit(0);
    }),
  );
