// 一次性测量脚本：量化 Next standalone 服务的启动时间
// 1) server 进程启动 → /api/health 就绪耗时
// 2) 首页 / 首次 SSR 的 TTFB（首字节）与总耗时
// 用法: node scripts/measure-startup.mjs [--cold]
import { spawn } from "node:child_process";
import http from "node:http";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const PORT = 3999;
const standalone = path.resolve(".next/standalone");
const serverPath = path.join(standalone, "server.js");

// 冷启动：用全新空目录作为数据目录（无磁盘缓存）
const dataDir = process.argv.includes("--cold")
  ? fs.mkdtempSync(path.join(os.tmpdir(), "cangxing-cold-"))
  : path.join(os.tmpdir(), "cangxing-warm-" + Date.now());

const t0 = Date.now();
const child = spawn(process.execPath, [serverPath], {
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
});

let bootLog = "";
child.stdout.on("data", (d) => (bootLog += d));
child.stderr.on("data", (d) => (bootLog += d));

function probeHealth(retries = 300) {
  const req = http.get(`http://127.0.0.1:${PORT}/api/health`, (res) => {
    res.resume();
    const ms = Date.now() - t0;
    console.log(`[health] 服务就绪耗时: ${ms}ms (${(ms / 1000).toFixed(2)}s)`);
    measureHome();
  });
  req.setTimeout(2000, () => req.destroy());
  req.on("error", () => {
    if (retries > 0) setTimeout(() => probeHealth(retries - 1), 100);
    else {
      console.log("[health] 超时，服务未能就绪");
      console.log("--- server 输出 ---\n" + bootLog.slice(-3000));
      cleanup(1);
    }
  });
}

function measureHome() {
  const t1 = Date.now();
  const req = http.get(`http://127.0.0.1:${PORT}/`, (res) => {
    let size = 0;
    res.on("data", (c) => (size += c.length));
    res.on("end", () => {
      const ms = Date.now() - t1;
      console.log(
        `[home] 首页首屏耗时: ${ms}ms (${(ms / 1000).toFixed(2)}s)，HTML ${(size / 1024).toFixed(1)}KB`,
      );
      console.log(`[total] 服务启动+首页: ${((Date.now() - t0) / 1000).toFixed(2)}s`);
      cleanup(0);
    });
  });
  req.setTimeout(120000, () => {
    console.log("[home] 首页请求超时（>120s）");
    cleanup(1);
  });
  req.on("error", (e) => {
    console.log("[home] 请求失败:", e.message);
    cleanup(1);
  });
}

function cleanup(code) {
  try {
    child.kill();
  } catch {}
  process.exit(code);
}

probeHealth();
