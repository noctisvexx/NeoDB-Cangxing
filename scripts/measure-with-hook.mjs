// 带 require 耗时探针的启动测量：定位 server 启动慢的模块
// 用法: node scripts/measure-with-hook.mjs [--cold]
import { spawn } from "node:child_process";
import http from "node:http";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const PORT = 3997;
const standalone = path.resolve(".next/standalone");
const dataDir = process.argv.includes("--cold")
  ? fs.mkdtempSync(path.join(os.tmpdir(), "cangxing-cold-"))
  : path.join(os.tmpdir(), "cangxing-hook-warm-" + Date.now());

const t0 = Date.now();
const child = spawn(
  process.execPath,
  ["-r", path.resolve("scripts/timing-hook.cjs"), path.join(standalone, "server.js")],
  {
    cwd: standalone,
    env: {
      ...process.env,
      PORT: String(PORT),
      HOSTNAME: "127.0.0.1",
      NODE_ENV: "production",
      CANGXING_DATA_DIR: dataDir,
      NEO_DB_REDIRECT_URI: `http://localhost:${PORT}/api/auth/callback`,
    },
    stdio: ["ignore", "pipe", "pipe"],
  },
);

let out = "";
child.stdout.on("data", (d) => (out += d));
child.stderr.on("data", (d) => (out += d));

function probeHealth(retries = 300) {
  const req = http.get(`http://127.0.0.1:${PORT}/api/health`, (res) => {
    res.resume();
    console.log(`[health] 就绪: ${Date.now() - t0}ms`);
    // 触发一次首页，让首次请求的 chunk 加载也计入统计，随后退出打印
    http
      .get(`http://127.0.0.1:${PORT}/`, (r2) => {
        r2.resume();
        r2.on("end", () => {
          console.log(`[home] 首页: ${Date.now() - t0}ms`);
          setTimeout(() => {
            child.kill();
            setTimeout(() => process.exit(0), 400);
          }, 500);
        });
      })
      .on("error", () => {
        child.kill();
        setTimeout(() => process.exit(0), 400);
      });
  });
  req.setTimeout(2000, () => req.destroy());
  req.on("error", () => {
    if (retries > 0) setTimeout(() => probeHealth(retries - 1), 100);
    else {
      child.kill();
      setTimeout(() => {
        console.log(out);
        process.exit(1);
      }, 400);
    }
  });
}

probeHealth();
