// 用指定 Node/运行时测量 server 冷启动耗时（可传 ELECTRON_RUN_AS_NODE 模式）
// 用法: node scripts/measure-runtime.mjs --node "<path>" [--electron-run-as-node] [--cold]
import { spawn } from "node:child_process";
import http from "node:http";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const args = process.argv.slice(2);
const nodeArgIdx = args.indexOf("--node");
const nodePath = nodeArgIdx >= 0 ? args[nodeArgIdx + 1] : process.execPath;
const useElectronNode = args.includes("--electron-run-as-node");
const useCold = args.includes("--cold");

const PORT = 3996;
const standalone = path.resolve(".next/standalone");
const serverPath = path.join(standalone, "server.js");
const dataDir = useCold
  ? fs.mkdtempSync(path.join(os.tmpdir(), "cangxing-cold-"))
  : path.join(os.tmpdir(), "cangxing-runtime-" + Date.now());

const env = {
  ...process.env,
  PORT: String(PORT),
  HOSTNAME: "127.0.0.1",
  NODE_ENV: "production",
  CANGXING_DATA_DIR: dataDir,
  NEO_DB_REDIRECT_URI: `http://localhost:${PORT}/api/auth/callback`,
};
if (useElectronNode) env.ELECTRON_RUN_AS_NODE = "1";

const t0 = Date.now();
const child = spawn(nodePath, [serverPath], {
  cwd: standalone,
  env,
  stdio: ["ignore", "ignore", "ignore"],
});

function probeHealth(retries = 300) {
  const req = http.get(`http://127.0.0.1:${PORT}/api/health`, (res) => {
    res.resume();
    console.log(
      `[${path.basename(nodePath)}${useCold ? " 冷" : " 热"}] health 就绪: ${Date.now() - t0}ms (${((Date.now() - t0) / 1000).toFixed(2)}s)`,
    );
    const t1 = Date.now();
    let firstChunkAt = 0;
    let size = 0;
    const req2 = http.get(`http://127.0.0.1:${PORT}/`, (res2) => {
      res2.on("data", (c) => {
        if (!firstChunkAt) firstChunkAt = Date.now() - t1;
        size += c.length;
      });
      res2.on("end", () => {
        const total = Date.now() - t1;
        console.log(
          `  └─ 首页 TTFB(首字节): ${firstChunkAt}ms (${(firstChunkAt / 1000).toFixed(2)}s)，完整响应: ${total}ms (${(total / 1000).toFixed(2)}s)，HTML ${(size / 1024 / 1024).toFixed(1)}MB`,
        );
        cleanup(0);
      });
    });
    req2.setTimeout(120000, () => cleanup(1));
    req2.on("error", () => cleanup(1));
  });
  req.setTimeout(2000, () => req.destroy());
  req.on("error", () => {
    if (retries > 0) setTimeout(() => probeHealth(retries - 1), 100);
    else {
      console.log(`[${path.basename(nodePath)}] 服务未就绪，超时`);
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
