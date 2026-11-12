import { readFile, mkdir, stat, rename, unlink } from "node:fs/promises";
import { createReadStream, createWriteStream } from "node:fs";
import { createHash } from "node:crypto";
import { pipeline } from "node:stream/promises";
import { Readable } from "node:stream";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
process.chdir(resolve(dirname(fileURLToPath(import.meta.url)), ".."));
if (await stat(".env").catch(() => null)) process.loadEnvFile(".env");
const manifest = JSON.parse(
  await readFile("scripts/vision-model.json", "utf8"),
);
const root = resolve(
  process.env.VISION_MODEL_DIR || "data/models",
  manifest.model,
);
async function checksum(path) {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(path)) hash.update(chunk);
  return hash.digest("hex");
}
for (const [name, info] of Object.entries(manifest.files)) {
  const path = resolve(root, name);
  if (await stat(path).catch(() => null)) {
    if ((await checksum(path)) === info.sha256) {
      console.log(`已就绪：${name}`);
      continue;
    }
  }
  await mkdir(dirname(path), { recursive: true });
  const sources = process.env.MODEL_DOWNLOAD_BASE
    ? [process.env.MODEL_DOWNLOAD_BASE]
    : ["https://huggingface.co", "https://hf-mirror.com"];
  let saved = false;
  for (const source of sources) {
    try {
      console.log(
        `下载 ${name}（${Math.round(info.bytes / 1024 / 1024)} MB），来源 ${source}`,
      );
      const response = await fetch(
        `${source.replace(/\/$/, "")}/${manifest.model}/resolve/${manifest.revision}/${name}`,
        { signal: AbortSignal.timeout(240000) },
      );
      if (!response.ok || !response.body)
        throw new Error(`HTTP ${response.status}`);
      await pipeline(
        Readable.fromWeb(response.body),
        createWriteStream(path + ".download"),
      );
      if ((await checksum(path + ".download")) !== info.sha256)
        throw new Error("文件校验不一致");
      await rename(path + ".download", path);
      saved = true;
      break;
    } catch (e) {
      console.error(`下载未完成：${e.message}`);
      await unlink(path + ".download").catch(() => {});
    }
  }
  if (!saved) {
    console.error(
      "模型未安装完成。稍后重试，或设置 MODEL_DOWNLOAD_BASE 为可访问的镜像。",
    );
    process.exit(1);
  }
}
console.log(
  "本地视觉模型已准备好。照片在当前服务中识别，不发送给模型下载站点。",
);
