const { app, BrowserWindow, shell } = require("electron");
const { spawn } = require("child_process");
const path = require("path");
const http = require("http");
const fs = require("fs");

const PORT = 3210;
let serverChild = null;
let windowOpened = false;

function getServerPath() {
  if (app.isPackaged) {
    return path.join(
      process.resourcesPath,
      "app.asar.unpacked",
      ".next",
      "standalone",
      "server.js",
    );
  }
  return path.join(
    __dirname,
    "..",
    "node_modules",
    "next",
    "dist",
    "bin",
    "next",
  );
}

function startServer() {
  const serverPath = getServerPath();
  const args = app.isPackaged ? [] : ["start", "-p", String(PORT)];
  // 打包后 cwd 指向 standalone 目录（静态资源按相对路径解析），
  // 用户数据（settings.json、令牌）通过 CANGXING_DATA_DIR 写到 userData
  const cwd = app.isPackaged
    ? path.dirname(serverPath)
    : path.join(__dirname, "..");
  const logPath = path.join(app.getPath("userData"), "server.log");
  const logFd = fs.openSync(logPath, "a");
  serverChild = spawn(process.execPath, [serverPath, ...args], {
    cwd,
    env: {
      ...process.env,
      ELECTRON_RUN_AS_NODE: "1",
      PORT: String(PORT),
      HOSTNAME: "127.0.0.1",
      NODE_ENV: "production",
      CANGXING_DATA_DIR: app.getPath("userData"),
      NEO_DB_REDIRECT_URI: `http://localhost:${PORT}/api/auth/callback`,
    },
    stdio: ["ignore", logFd, logFd],
  });
  serverChild.on("exit", () => {
    if (!app.isQuitting && !windowOpened) {
      // 服务器还没启动就退出，弹出错误页而不是无声退出
      createWindow(
        `data:text/html;charset=utf-8,${encodeURIComponent(
          `<h2>藏星未能启动</h2><p>内置服务启动失败，请查看日志：${logPath}</p>`,
        )}`,
      );
    }
  });
}

function createWindow(url = `http://127.0.0.1:${PORT}`) {
  windowOpened = true;
  const win = new BrowserWindow({
    width: 1360,
    height: 900,
    minWidth: 960,
    minHeight: 640,
    title: "藏星 · CANGXING",
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  win.webContents.setWindowOpenHandler(({ url: u }) => {
    shell.openExternal(u);
    return { action: "deny" };
  });
  win.loadURL(url);
}

function waitForServer(retries = 45) {
  http
    .get(`http://127.0.0.1:${PORT}`, () => createWindow())
    .on("error", () => {
      if (retries > 0) {
        setTimeout(() => waitForServer(retries - 1), 1000);
      } else if (!windowOpened) {
        createWindow(
          `data:text/html;charset=utf-8,${encodeURIComponent(
            "<h2>藏星加载超时</h2><p>内置服务未能就绪，请查看日志后重试。</p>",
          )}`,
        );
      }
    });
}

app.whenReady().then(() => {
  startServer();
  waitForServer();
});

app.on("window-all-closed", () => {
  app.isQuitting = true;
  if (serverChild) serverChild.kill();
  app.quit();
});
