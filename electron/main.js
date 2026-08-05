const { app, BrowserWindow, shell, Tray, Menu, nativeImage } = require("electron");
const { spawn, execFile } = require("child_process");
const path = require("path");
const http = require("http");
const fs = require("fs");

const PORT = 3210;
const HEALTH_INTERVAL = 100;
// 启动闪屏：服务器就绪前先显示窗口，避免用户面对长时间空白
const SPLASH_URL = `data:text/html;charset=utf-8,${encodeURIComponent(
  `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><style>
html,body{margin:0;height:100%}
body{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:18px;background:#07090d;color:#d4d4d8;font-family:system-ui,-apple-system,"Segoe UI",sans-serif}
.star{width:44px;height:44px;fill:#f59e0b;animation:pulse 1.2s ease-in-out infinite}
@keyframes pulse{0%,100%{transform:scale(1);opacity:1}50%{transform:scale(1.15);opacity:.75}}
.spin{width:22px;height:22px;border-radius:50%;border:2px solid rgba(245,158,11,.25);border-top-color:#f59e0b;animation:rot .8s linear infinite}
@keyframes rot{to{transform:rotate(360deg)}}
</style></head><body>
<svg class="star" viewBox="0 0 24 24"><path d="M12 2c1.2 5.5 4.3 8.8 10 10-5.7 1.2-8.8 4.5-10 10-1.2-5.5-4.3-8.8-10-10 5.7-1.2 8.8-4.5 10-10Z"/></svg>
<div class="spin"></div>
<div style="font-size:13px;color:#71717a;letter-spacing:.2em">藏星 正在启动…</div>
</body></html>`,
)}`;
let serverChild = null;
let serverReady = false;
let appUrlLoaded = false;
let mainWindow = null;
let tray = null;
let configTimer = null;
let authTimer = null;

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
      APP_VERSION: app.getVersion(),
      CANGXING_DATA_DIR: app.getPath("userData"),
      NEO_DB_REDIRECT_URI: `http://localhost:${PORT}/api/auth/callback`,
    },
    stdio: ["ignore", logFd, logFd],
  });
  serverChild.on("exit", () => {
    if (!app.isQuitting && !serverReady) {
      // 服务器还没启动就退出，弹出错误页而不是无声退出
      showErrorPage("藏星未能启动", `内置服务启动失败，请查看日志：${logPath}`);
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
    waitForServer(180, true);
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

function isInternalUrl(url) {
  try {
    const u = new URL(url);
    return (
      (u.hostname === "127.0.0.1" || u.hostname === "localhost") &&
      (u.port === "" || u.port === String(PORT))
    );
  } catch {
    return false;
  }
}

// 窗口内导航到外部站点（如 NeoDB OAuth 登录页）时，改为用系统默认浏览器打开，
// 避免登录页把应用窗口"劫持"走
function openExternalNavigation(event, url) {
  if (isInternalUrl(url)) return;
  event.preventDefault();
  shell.openExternal(url);
}

// NeoDB 授权在系统浏览器完成后，令牌文件变化时自动刷新应用窗口
function watchAuthFile() {
  const authFile = path.join(
    app.getPath("userData"),
    "data",
    "neodb-auth.json",
  );
  let lastRaw = "";
  try {
    lastRaw = fs.readFileSync(authFile, "utf8");
  } catch (e) {
    // 文件还不存在，首次授权写入时会被轮询到
  }
  fs.watchFile(authFile, { interval: 1000 }, () => {
    let raw = "";
    try {
      raw = fs.readFileSync(authFile, "utf8");
    } catch {
      // 忽略
    }
    if (raw && raw !== lastRaw) {
      lastRaw = raw;
      clearTimeout(authTimer);
      authTimer = setTimeout(() => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.reload();
        }
      }, 800);
    }
  });
}

function createWindow(url = SPLASH_URL) {
  mainWindow = new BrowserWindow({
    width: 1360,
    height: 900,
    minWidth: 960,
    minHeight: 640,
    title: "藏星 · CANGXING",
    autoHideMenuBar: true,
    show: false,
    backgroundColor: "#07090d",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  // 闪屏就绪后立即显示，避免白色闪烁
  mainWindow.once("ready-to-show", () => {
    mainWindow.show();
    mainWindow.focus();
  });
  mainWindow.webContents.setWindowOpenHandler(({ url: u }) => {
    shell.openExternal(u);
    return { action: "deny" };
  });
  mainWindow.webContents.on("will-navigate", (event, url) => {
    openExternalNavigation(event, url);
  });
  mainWindow.webContents.on("will-redirect", (event, url) => {
    openExternalNavigation(event, url);
  });
  // 点右上角 × 时只隐藏到托盘，程序继续在后台运行；真正退出走托盘菜单
  mainWindow.on("close", (event) => {
    if (!app.isQuitting) {
      event.preventDefault();
      mainWindow.hide();
    }
  });
  mainWindow.loadURL(url);
}

// 服务启动失败/超时时，在已有窗口里展示错误页而不是新开窗口
function showErrorPage(title, message) {
  const html = `data:text/html;charset=utf-8,${encodeURIComponent(
    `<div style="height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;background:#07090d;color:#d4d4d8;font-family:system-ui,sans-serif;text-align:center;padding:24px"><h2 style="margin:0;font-size:18px;color:#f59e0b">${title}</h2><p style="margin:0;font-size:13px;color:#71717a;max-width:480px">${message}</p></div>`,
  )}`;
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.loadURL(html);
    mainWindow.show();
    mainWindow.focus();
  } else {
    createWindow(html);
  }
}

// 提前打一次首页，让冷启动的数据抓取在闪屏阶段就并行进行；
// 首页数据走 getCachedByKey 单飞缓存，窗口请求会复用同一次上游请求
function warmUpHome() {
  const req = http.get(`http://127.0.0.1:${PORT}/`, (res) => res.resume());
  req.setTimeout(15000, () => req.destroy());
  req.on("error", () => {});
}

// 服务就绪后从闪屏切换到真正的应用页面
function loadAppUrl() {
  if (appUrlLoaded) return;
  appUrlLoaded = true;
  warmUpHome();
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.loadURL(`http://127.0.0.1:${PORT}`);
  }
}

function showMainWindow() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
}

function trayIconImage() {
  // 打包后图标在 resources/icon.png（见 package.json extraResources）
  const file = app.isPackaged
    ? path.join(process.resourcesPath, "icon.png")
    : path.join(__dirname, "..", "build", "icon.png");
  try {
    if (fs.existsSync(file)) {
      const img = nativeImage.createFromPath(file);
      if (!img.isEmpty()) return img;
    }
  } catch {
    // 忽略
  }
  return nativeImage.createEmpty();
}

function createTray() {
  tray = new Tray(trayIconImage());
  tray.setToolTip("藏星 · CANGXING");
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: "打开藏星", click: showMainWindow },
      { type: "separator" },
      {
        label: "退出",
        click: () => {
          app.isQuitting = true;
          if (serverChild) serverChild.kill();
          app.quit();
        },
      },
    ]),
  );
  tray.on("click", showMainWindow);
  tray.on("double-click", showMainWindow);
}

function waitForServer(retries = 180, reload = false) {
  http
    .get(`http://127.0.0.1:${PORT}/api/health`, (res) => {
      res.resume();
      serverReady = true;
      if (reload) {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.reload();
        }
      } else if (!appUrlLoaded) {
        loadAppUrl();
      }
    })
    .on("error", () => {
      if (retries > 0) {
        setTimeout(() => waitForServer(retries - 1, reload), HEALTH_INTERVAL);
      } else if (!serverReady) {
        showErrorPage("藏星加载超时", "内置服务未能就绪，请查看日志后重试。");
      }
    });
}

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  // 后台运行期间再次启动程序时，聚焦已有窗口而不是再开一个实例（避免端口冲突）
  app.on("second-instance", () => showMainWindow());

  app.whenReady().then(() => {
    // 先显示启动闪屏，再在后台拉起内置服务（服务子进程与 Chromium 初始化同时进行会抢 CPU，反而更慢）
    createWindow();
    loadConfig();
    startServer();
    waitForServer(180, false);
    if (configExists) {
      applyAutoLaunch(appConfig.autoLaunch);
      autoLaunchApplied = appConfig.autoLaunch;
      lanModeApplied = appConfig.lanMode;
    }
    // 始终监听配置目录，首次在设置页开启开关时也能生效
    watchConfig();
    watchAuthFile();
    createTray();
  });

  app.on("window-all-closed", () => {
    app.isQuitting = true;
    if (serverChild) serverChild.kill();
    app.quit();
  });
}
