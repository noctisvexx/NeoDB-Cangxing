// 分阶段计时：定位 standalone server 启动时间花在哪
// 用法: node scripts/measure-boot-phases.mjs [--cold|--warm]
import { spawn } from "node:child_process";
import http from "node:http";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const PORT = 3998;
const standalone = path.resolve(".next/standalone");

const useCold = process.argv.includes("--cold");
const dataDir = useCold
  ? fs.mkdtempSync(path.join(os.tmpdir(), "cangxing-cold-"))
  : path.join(os.tmpdir(), "cangxing-warm-boot");

const t0 = Date.now();
// 用 node -e 注入阶段计时探针：打印 require('next') 完成 / listen 完成
const probe = `
const t0 = Date.now();
require('next');
console.log('[phase] require(next) 完成: ' + (Date.now() - t0) + 'ms');
const { startServer } = require('next/dist/server/lib/start-server');
const fs = require('fs');
const origListen = ...;
`;
// 更简单可靠：直接 spawn server.js，然后从 stdout 监听"服务已就绪"日志
const child = spawn(process.execPath, [path.join(standalone, "server.js")], {
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
    console.log(
      `[phase] spawn→health 就绪: ${Date.now() - t0}ms (${((Date.now() - t0) / 1000).toFixed(2)}s)`,
    );
    cleanup(0);
  });
  req.setTimeout(2000, () => req.destroy());
  req.on("error", () => {
    if (retries > 0) setTimeout(() => probeHealth(retries - 1), 100);
    else {
      console.log("[phase] 超时");
      cleanup(1);
    }
  });
}

function cleanup(code) {
  try {
    child.kill();
  } catch {}
  process.exit(code);
}

probeHealth();
