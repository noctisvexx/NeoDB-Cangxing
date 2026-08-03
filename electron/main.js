const { app, BrowserWindow, shell } = require("electron");
const { spawn, execFile } = require("child_process");
const path = require("path");
const http = require("http");
const fs = require("fs");

const PORT = 3210;
let serverChild = null;
let windowOpened = false;
let mainWindow = null;
let configTimer = null;

// 应用级配置（局域网访问 / 开机自启），保存在 userData/app-config.json
let appConfig = { lanMode: false, autoLaunch: false };
let configExists = false;
let lanModeApplied = false;
let autoLaunchApplied = false;

function configPath() {
  return path.join(app.getPath("userData"), "app-config.json");
}

function loadConfig() {
  try {
    const raw = fs.readFileSync(configPath(), "utf8");
    const parsed = JSON.parse(raw);
    appConfig = {
      lanMode: !!parsed.lanMode,
      autoLaunch: !!parsed.autoLaunch,
    };
    configExists = true;
  } catch {
    appConfig = { lanMode: false, autoLaunch: false };
    configExists = false;
  }
  return appConfig;
}

function getServerPath() {
  if (app.isPackaged) {
    return path.join(
      process.resourcesPath,
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
      // 局域网模式监听所有网卡，否则仅本机
      HOSTNAME: appConfig.lanMode ? "0.0.0.0" : "127.0.0.1",
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

function restartServer() {
  if (serverChild) {
    try {
      serverChild.kill();
    } catch {
      // 忽略
    }
    serverChild = null;
  }
  // 稍等旧进程释放端口后再启动，随后刷新窗口
  setTimeout(() => {
    startServer();
    waitForServer(45, true);
  }, 800);
}

function applyAutoLaunch(enabled) {
  try {
    const portableExe = process.env.PORTABLE_EXECUTABLE_FILE;
    if (portableExe) {
      // 绿色版：注册到 HKCU 启动项（exe 路径取自便携版包装器）
      const runKey = "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run";
      const valueName = "Cangxing";
      const args = enabled
        ? [
            "add",
            runKey,
            "/v",
            valueName,
            "/t",
            "REG_SZ",
            "/d",
            `"${portableExe}"`,
            "/f",
          ]
        : ["delete", runKey, "/v", valueName, "/f"];
      execFile("reg", args, (err) => {
        if (err) console.error("设置开机自启失败：", err.message);
      });
    } else {
      // 安装版：使用 Electron 标准开机自启
      app.setLoginItemSettings({ openAtLogin: enabled });
    }
  } catch (e) {
    console.error("设置开机自启失败：", e);
  }
}

function watchConfig() {
  try {
    const configDir = path.dirname(configPath());
    fs.watch(configDir, (_event, filename) => {
      if (filename && filename !== path.basename(configPath())) return;
      clearTimeout(configTimer);
      configTimer = setTimeout(() => {
        const next = loadConfig();
        if (!configExists) return;
        if (next.autoLaunch !== autoLaunchApplied) {
          autoLaunchApplied = next.autoLaunch;
          applyAutoLaunch(next.autoLaunch);
        }
        if (next.lanMode !== lanModeApplied) {
          lanModeApplied = next.lanMode;
          restartServer();
        }
      }, 500);
    });
  } catch (e) {
    console.error("监听配置失败：", e.message);
  }
}

function createWindow(url = `http://127.0.0.1:${PORT}`) {
  windowOpened = true;
  mainWindow = new BrowserWindow({
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
  mainWindow.webContents.setWindowOpenHandler(({ url: u }) => {
    shell.openExternal(u);
    return { action: "deny" };
  });
  mainWindow.loadURL(url);
}

function waitForServer(retries = 45, reload = false) {
  http
    .get(`http://127.0.0.1:${PORT}`, () => {
      if (reload && mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.reload();
      } else {
        createWindow();
      }
    })
    .on("error", () => {
      if (retries > 0) {
        setTimeout(() => waitForServer(retries - 1, reload), 1000);
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
  loadConfig();
  startServer();
  waitForServer(45, false);
  if (configExists) {
    applyAutoLaunch(appConfig.autoLaunch);
    autoLaunchApplied = appConfig.autoLaunch;
    lanModeApplied = appConfig.lanMode;
  }
  // 始终监听配置目录，首次在设置页开启开关时也能生效
  watchConfig();
});

app.on("window-all-closed", () => {
  app.isQuitting = true;
  if (serverChild) serverChild.kill();
  app.quit();
});
