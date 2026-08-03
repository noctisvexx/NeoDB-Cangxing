"use client";

import { useEffect, useState } from "react";
import ConnectNeoDB from "@/components/ConnectNeoDB";
import { normalizeTitle } from "@/lib/utils";

interface SettingsStatus {
  tmdbApiKey?: string;
  omdbApiKey?: string;
  aiApiKey?: string;
  wereadApiKey?: string;
  neoDbClientId?: string;
  neoDbClientSecret?: string;
  tmdbConfigured: boolean;
  omdbConfigured: boolean;
  aiConfigured: boolean;
  aiBaseUrl: string;
  aiModel: string;
  wereadConfigured: boolean;
  neoDbClientIdSet: boolean;
  neoDbClientSecretSet: boolean;
  neoDbClientConfigured: boolean;
  neoDbConnected: boolean;
  instance: string;
}

type DirtyFields = {
  tmdb?: boolean;
  omdb?: boolean;
  ai?: boolean;
  aiBaseUrl?: boolean;
  aiModel?: boolean;
  weread?: boolean;
  order?: boolean;
  webdavUrl?: boolean;
  webdavUser?: boolean;
  webdavPass?: boolean;
  titleOverrides?: boolean;
  clientId?: boolean;
  clientSecret?: boolean;
};

const DEFAULT_SECTION_ORDER = [
  "movie",
  "tv",
  "anime",
  "book",
  "game",
  "music",
  "podcast",
];

const SECTION_NAMES: Record<string, string> = {
  movie: "热门电影",
  tv: "热门剧集",
  anime: "热门动漫",
  book: "热门书籍",
  game: "热门游戏",
  music: "热门音乐",
  podcast: "热门播客",
};

const AI_PRESETS = [
  {
    name: "OpenAI / ChatGPT",
    base: "https://api.openai.com/v1",
    model: "gpt-4o-mini",
  },
  {
    name: "DeepSeek",
    base: "https://api.deepseek.com/v1",
    model: "deepseek-chat",
  },
  {
    name: "Gemini",
    base: "https://generativelanguage.googleapis.com/v1beta/openai",
    model: "gemini-2.0-flash",
  },
  {
    name: "智谱 GLM",
    base: "https://open.bigmodel.cn/api/paas/v4",
    model: "glm-4-flash",
  },
];

function Switch({
  checked,
  onChange,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative h-6 w-11 shrink-0 rounded-full transition ${
        checked ? "bg-teal-500" : "bg-zinc-700"
      } ${disabled ? "opacity-50" : ""}`}
    >
      <span
        className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${
          checked ? "left-[22px]" : "left-0.5"
        }`}
      />
    </button>
  );
}

export default function SettingsPage() {
  const [status, setStatus] = useState<SettingsStatus | null>(null);
  const [tmdbKey, setTmdbKey] = useState("");
  const [omdbKey, setOmdbKey] = useState("");
  const [aiKey, setAiKey] = useState("");
  const [aiBaseUrl, setAiBaseUrl] = useState("");
  const [aiModel, setAiModel] = useState("");
  const [wereadKey, setWereadKey] = useState("");
  const [models, setModels] = useState<string[]>([]);
  const [orderList, setOrderList] = useState<string[]>(DEFAULT_SECTION_ORDER);
  const [showKeys, setShowKeys] = useState<Record<string, boolean>>({});
  const [customModel, setCustomModel] = useState(false);
  const [backupPassword, setBackupPassword] = useState("");
  const [webdavUrl, setWebdavUrl] = useState("");
  const [webdavUser, setWebdavUser] = useState("");
  const [webdavPass, setWebdavPass] = useState("");
  const [backupMsg, setBackupMsg] = useState<string | null>(null);
  const [backupError, setBackupError] = useState<string | null>(null);
  const [bridgeBusy, setBridgeBusy] = useState<"import" | "export" | null>(null);
  const [bridgeMsg, setBridgeMsg] = useState<string | null>(null);
  const [bridgeError, setBridgeError] = useState<string | null>(null);
  const [sysConfig, setSysConfig] = useState<{
    lanMode: boolean;
    autoLaunch: boolean;
    port: number;
    lanUrls: string[];
  } | null>(null);
  const [sysBusy, setSysBusy] = useState(false);
  const [overridesList, setOverridesList] = useState<
    { orig: string; fixed: string }[]
  >([]);
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [dirty, setDirty] = useState<DirtyFields>({});
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((data) => {
        setStatus(data);
        setTmdbKey(data.tmdbApiKey ?? "");
        setOmdbKey(data.omdbApiKey ?? "");
        setAiKey(data.aiApiKey ?? "");
        setAiBaseUrl(data.aiBaseUrl ?? "");
        setAiModel(data.aiModel ?? "");
        setWereadKey(data.wereadApiKey ?? "");
        setWebdavUrl(data.webdavUrl ?? "");
        setWebdavUser(data.webdavUser ?? "");
        setWebdavPass(data.webdavPass ?? "");
        setClientId(data.neoDbClientId ?? "");
        setClientSecret(data.neoDbClientSecret ?? "");
        if (data.titleOverrides && typeof data.titleOverrides === "object") {
          setOverridesList(
            Object.entries(data.titleOverrides).map(([orig, fixed]) => ({
              orig,
              fixed: String(fixed),
            })),
          );
        }
        if (Array.isArray(data.sectionOrder) && data.sectionOrder.length > 0) {
          setOrderList(data.sectionOrder);
        }
      })
      .catch(() => setStatus(null));
    fetch("/api/system/config")
      .then((r) => r.json())
      .then(setSysConfig)
      .catch(() => {});
    try {
      const saved = localStorage.getItem("shibei-backup-pass");
      if (saved) setBackupPassword(saved);
    } catch {
      // 忽略
    }
  }, []);

  function markDirty(field: keyof DirtyFields) {
    setDirty((prev) => ({ ...prev, [field]: true }));
  }

  async function saveFields(
    fields: Record<string, unknown>,
    dirtyKeys: (keyof DirtyFields)[],
  ) {
    if (Object.keys(fields).length === 0) {
      setMessage("没有需要保存的更改");
      return;
    }
    setBusy(true);
    setMessage(null);
    setError(null);
    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(fields),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "保存失败");
      if (data.omdbValid === false) {
        setError(
          "OMDb Key 无效（401）：文档里的示例 Key 不可用，请到 omdbapi.com 用邮箱申请自己的 Key",
        );
      } else if (data.tmdbValid === false) {
        setError(
          "TMDB Key 无效（401）：请检查填的是 API Key (v3) 还是 API Read Access Token (v4)，两种都可以，但内容要完整",
        );
      } else if (data.aiValid === false) {
        setError(
          "AI Key 无效：接口拒绝了该 Key（401）。请检查 Key 是否完整，或点选对应的服务商预设后重试",
        );
      } else {
        if (
          (data.neoDbClientIdSet && !data.neoDbClientSecretSet) ||
          (!data.neoDbClientIdSet && data.neoDbClientSecretSet)
        ) {
          setError(
            "注意：Client ID 与 Client Secret 需要成对填写才能完成 NeoDB 连接",
          );
        } else {
          setError(null);
        }
      }
      setStatus((prev) => ({
        ...(prev ?? {
          instance: "",
          neoDbConnected: false,
          omdbConfigured: false,
          aiConfigured: false,
          aiBaseUrl: "",
          aiModel: "",
          wereadConfigured: false,
          neoDbClientIdSet: false,
          neoDbClientSecretSet: false,
        }),
        tmdbConfigured: data.tmdbConfigured,
        omdbConfigured: data.omdbConfigured,
        aiConfigured: data.aiConfigured,
        aiBaseUrl: data.aiBaseUrl,
        aiModel: data.aiModel,
        wereadConfigured: data.wereadConfigured,
        neoDbClientConfigured: data.neoDbClientConfigured,
        neoDbClientIdSet: data.neoDbClientIdSet,
        neoDbClientSecretSet: data.neoDbClientSecretSet,
      }));
      setDirty((prev) => {
        const next = { ...prev };
        for (const k of dirtyKeys) delete next[k];
        return next;
      });
      setMessage(
        data.omdbValid === true
          ? "已保存，OMDb Key 验证通过 ✓"
          : data.aiValid === true
            ? "已保存，AI Key 验证通过 ✓"
          : "已保存，立即生效 ✓",
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "保存失败");
    } finally {
      setBusy(false);
    }
  }

  async function fetchModels() {
    setBusy(true);
    setMessage(null);
    setError(null);
    try {
      const res = await fetch("/api/ai/models", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          baseUrl:
            aiBaseUrl ||
            status?.aiBaseUrl ||
            "https://api.openai.com/v1",
          apiKey: aiKey,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "获取模型失败");
      const list = data.models ?? [];
      setModels(list);
      if (list.length > 0 && !aiModel) setAiModel(list[0]);
      setMessage(`获取到 ${list.length} 个模型，请选择或直接输入`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "获取模型失败");
    } finally {
      setBusy(false);
    }
  }

  function moveSection(k: number, dir: -1 | 1) {
    setOrderList((prev) => {
      const next = [...prev];
      const j = k + dir;
      if (j < 0 || j >= next.length) return prev;
      [next[k], next[j]] = [next[j], next[k]];
      return next;
    });
    markDirty("order");
  }

  function toggleKey(k: string) {
    setShowKeys((prev) => ({ ...prev, [k]: !prev[k] }));
  }

  async function deriveKey(password: string): Promise<CryptoKey> {
    const enc = new TextEncoder();
    const material = await crypto.subtle.importKey(
      "raw",
      enc.encode(password),
      "PBKDF2",
      false,
      ["deriveKey"],
    );
    return crypto.subtle.deriveKey(
      {
        name: "PBKDF2",
        salt: enc.encode("shibei-backup-v1"),
        iterations: 100000,
        hash: "SHA-256",
      },
      material,
      { name: "AES-GCM", length: 256 },
      false,
      ["encrypt", "decrypt"],
    );
  }

  const toB64 = (b: ArrayBuffer) =>
    btoa(String.fromCharCode(...new Uint8Array(b)));
  const fromB64 = (s: string) =>
    Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

  async function encryptText(text: string, password: string): Promise<string> {
    const key = await deriveKey(password);
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ct = await crypto.subtle.encrypt(
      { name: "AES-GCM", iv },
      key,
      new TextEncoder().encode(text),
    );
    return `${toB64(iv.buffer)}.${toB64(ct)}`;
  }

  async function decryptText(bundle: string, password: string): Promise<string> {
    const [ivB64, ctB64] = bundle.split(".");
    if (!ivB64 || !ctB64) throw new Error("备份文件格式错误");
    const key = await deriveKey(password);
    const pt = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: fromB64(ivB64) },
      key,
      fromB64(ctB64),
    );
    return new TextDecoder().decode(pt);
  }

  async function currentPayload() {
    const res = await fetch("/api/settings");
    const data = await res.json();
    const [profileRes, marksRes] = await Promise.all([
      fetch("/api/profile"),
      fetch("/api/local/marks"),
    ]);
    const profile = (await profileRes.json().catch(() => ({}))) as {
      nickname?: string;
      avatar?: string;
    };
    const marksData = (await marksRes.json().catch(() => ({}))) as {
      marks?: unknown[];
    };
    return {
      tmdbApiKey: data.tmdbApiKey ?? "",
      omdbApiKey: data.omdbApiKey ?? "",
      aiApiKey: data.aiApiKey ?? "",
      aiBaseUrl: data.aiBaseUrl ?? "",
      aiModel: data.aiModel ?? "",
      wereadApiKey: data.wereadApiKey ?? "",
      neoDbClientId: data.neoDbClientId ?? "",
      neoDbClientSecret: data.neoDbClientSecret ?? "",
      sectionOrder: data.sectionOrder ?? undefined,
      profile:
        profile.nickname || profile.avatar ? profile : undefined,
      localMarks: Array.isArray(marksData.marks)
        ? marksData.marks
        : undefined,
    };
  }

  async function applyPayload(payload: Record<string, unknown>) {
    const { profile, localMarks, ...settingsPayload } = payload;
    const res = await fetch("/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(settingsPayload),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? "应用失败");
    if (profile && typeof profile === "object") {
      const r = await fetch("/api/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(profile),
      });
      if (!r.ok) throw new Error("恢复本地档案失败");
    }
    if (Array.isArray(localMarks)) {
      const r = await fetch("/api/local/marks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "import", marks: localMarks }),
      });
      if (!r.ok) throw new Error("恢复本地标记失败");
    }
    window.location.reload();
  }

  async function exportBackup() {
    setBackupMsg(null);
    setBackupError(null);
    if (!backupPassword) {
      setBackupError("请先填写备份密码");
      return;
    }
    try {
      const payload = await currentPayload();
      const blob = await encryptText(
        JSON.stringify(payload),
        backupPassword,
      );
      const a = document.createElement("a");
      a.href = URL.createObjectURL(new Blob([blob], { type: "text/plain" }));
      a.download = "cangxing-backup.txt";
      a.click();
      URL.revokeObjectURL(a.href);
      setBackupMsg("备份已导出（用备份密码加密，请妥善保管密码）");
    } catch (e) {
      setBackupError(e instanceof Error ? e.message : "导出失败");
    }
  }

  async function importBackup(file: File) {
    setBackupMsg(null);
    setBackupError(null);
    if (!backupPassword) {
      setBackupError("请先填写备份密码");
      return;
    }
    try {
      const text = await file.text();
      const json = await decryptText(text, backupPassword);
      await applyPayload(JSON.parse(json));
    } catch (e) {
      setBackupError(
        e instanceof Error ? e.message : "导入失败（密码可能不对）",
      );
    }
  }

  async function webdavUpload() {
    setBackupMsg(null);
    setBackupError(null);
    if (!backupPassword) {
      setBackupError("请先填写备份密码");
      return;
    }
    try {
      const payload = await currentPayload();
      const blob = await encryptText(
        JSON.stringify(payload),
        backupPassword,
      );
      const res = await fetch("/api/settings/webdav", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "put", blob }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "上传失败");
      setBackupMsg("已加密上传到 WebDAV");
    } catch (e) {
      setBackupError(e instanceof Error ? e.message : "上传失败");
    }
  }

  async function webdavDownload() {
    setBackupMsg(null);
    setBackupError(null);
    if (!backupPassword) {
      setBackupError("请先填写备份密码");
      return;
    }
    try {
      const res = await fetch("/api/settings/webdav");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "下载失败");
      const json = await decryptText(data.blob, backupPassword);
      await applyPayload(JSON.parse(json));
    } catch (e) {
      setBackupError(
        e instanceof Error ? e.message : "下载/解密失败（密码可能不对）",
      );
    }
  }

  async function runBridge(kind: "import" | "export") {
    setBridgeBusy(kind);
    setBridgeMsg(null);
    setBridgeError(null);
    try {
      const res = await fetch(
        kind === "import"
          ? "/api/local/import-neodb"
          : "/api/local/export-neodb",
        { method: "POST" },
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "操作失败");
      if (kind === "import") {
        setBridgeMsg(
          `已从 NeoDB 导入 ${data.imported ?? 0} 条标记到本地档案${
            data.total ? `（共读取 ${data.total} 条）` : ""
          }${data.errors?.length ? `，另有 ${data.errors.length} 处读取告警` : ""}`,
        );
      } else {
        setBridgeMsg(
          `已导出 ${data.exported ?? 0} 条到 NeoDB${
            data.matched ? `（其中新匹配条目 ${data.matched} 条）` : ""
          }${data.failed ? `，${data.failed} 条失败` : ""}`,
        );
      }
      if (data.errors?.length) {
        setBridgeError((data.errors as string[]).slice(0, 5).join("；"));
      }
    } catch (e) {
      setBridgeError(e instanceof Error ? e.message : "操作失败");
    } finally {
      setBridgeBusy(null);
    }
  }

  async function updateSysConfig(patch: {
    lanMode?: boolean;
    autoLaunch?: boolean;
  }) {
    setSysBusy(true);
    setMessage(null);
    setError(null);
    try {
      const res = await fetch("/api/system/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "保存失败");
      setSysConfig(data);
      setMessage(
        patch.lanMode !== undefined
          ? "局域网设置已保存，服务正在自动重启（窗口稍后会刷新）"
          : "开机自启设置已保存",
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "局域网设置保存失败");
    } finally {
      setSysBusy(false);
    }
  }

  const activePreset = AI_PRESETS.find(
    (p) => p.base === (aiBaseUrl || status?.aiBaseUrl),
  );

  const statusRow = (ok: boolean, yes: string, no: string) =>
    ok ? (
      <span className="text-emerald-400">● {yes}</span>
    ) : (
      <span className="text-zinc-500">○ {no}</span>
    );

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-8">
      <h1 className="title-accent mb-6 text-2xl font-bold">设置</h1>

      <div className="mb-6 rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5">
        <h2 className="mb-2 font-medium text-zinc-100">
          ① NeoDB 账号连接
        </h2>
        <p className="mb-3 text-sm text-zinc-400">
          {status &&
            statusRow(
              status.neoDbConnected,
              "已连接（OAuth 一年期令牌）",
              "未连接（需先完成下面 ② 的凭据填写）",
            )}
        </p>
        <a
          href="/me"
          className="inline-block rounded-lg bg-amber-500 px-4 py-2 text-sm font-medium text-zinc-950 transition hover:bg-amber-400"
        >
          前往「我的」连接 / 重新授权
        </a>
      </div>

      <div className="mb-6 rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5">
        <h2 className="mb-2 font-medium text-zinc-100">
          ② NeoDB 应用
        </h2>
        {status?.neoDbClientConfigured ? (
          <p className="mb-3 rounded-lg bg-emerald-500/10 px-3 py-2 text-sm text-emerald-400">
            ✓ 已配置：日常只需去「我的」页点「连接到 NeoDB」完成账号授权，无需修改这里。
          </p>
        ) : (
          <div className="mb-4 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4">
            <p className="mb-2 text-sm text-zinc-300">
              无需手动创建应用，点下面按钮自动创建并跳转授权：
            </p>
            <ConnectNeoDB />
          </div>
        )}
        <details className="text-sm">
          <summary className="cursor-pointer text-zinc-400 hover:text-zinc-200">
            {status?.neoDbClientConfigured
              ? "高级：修改应用凭据"
              : "高级：手动填写凭据"}
          </summary>
          <div className="mt-3">
            <p className="mb-3 text-xs text-zinc-500">
              在 NeoDB 开发者页「新增应用」后（Redirect URI 填
              http://localhost:3210/api/auth/callback），把两项凭据粘贴到这里。
            </p>
        <label className="mb-2 block text-sm">
          <span className="mb-1 block text-zinc-400">Client ID</span>
          <input
            value={clientId}
            onChange={(e) => {
              setClientId(e.target.value);
              markDirty("clientId");
            }}
            placeholder={
              status?.neoDbClientIdSet
                ? "已填写，留空保持不变"
                : "uT9mDhCHc..."
            }
            className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-amber-500 focus:outline-none"
          />
        </label>
        <label className="mb-3 block text-sm">
          <span className="mb-1 flex items-center justify-between text-zinc-400">
            Client Secret
            <button
              type="button"
              onClick={() => toggleKey("secret")}
              className="text-xs text-zinc-500 hover:text-zinc-300"
            >
              {showKeys.secret ? "🙈 隐藏" : "👁 显示"}
            </button>
          </span>
          <input
            value={clientSecret}
            onChange={(e) => {
              setClientSecret(e.target.value);
              markDirty("clientSecret");
            }}
            placeholder={
              status?.neoDbClientSecretSet
                ? "已填写，留空保持不变"
                : "BMYR8144..."
            }
            type={showKeys.secret ? "text" : "password"}
            className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-amber-500 focus:outline-none"
          />
        </label>
        <button
          type="button"
          onClick={() =>
            saveFields(
              {
                ...(dirty.clientId
                  ? { neoDbClientId: clientId }
                  : {}),
                ...(dirty.clientSecret
                  ? { neoDbClientSecret: clientSecret }
                  : {}),
              },
              ["clientId", "clientSecret"],
            )
          }
          disabled={busy}
          className="mt-3 rounded-lg bg-amber-500 px-4 py-2 text-sm font-medium text-zinc-950 transition hover:bg-amber-400 disabled:opacity-50"
        >
          保存 NeoDB 凭据
        </button>
          </div>
        </details>
      </div>

      <div className="mb-6 rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5">
        <h2 className="mb-2 font-medium text-zinc-100">
          ③ TMDB API Key
        </h2>
        <p className="mb-3 text-xs text-zinc-500">
          在{" "}
          <a
            href="https://www.themoviedb.org/settings/api"
            target="_blank"
            rel="noreferrer"
            className="text-amber-400 hover:underline"
          >
            TMDB API 申请页
          </a>{" "}
          申请后，API Key (v3) 或 API Read Access Token（v4）两种都可以填，
          应用会自动识别。表单建议：类型选 Website，名称随便写（如
              Discovery Sea），应用 URL 填 http://localhost:3210（不会验证），
          用途说明写"个人本地使用的书影音发现工具"。申请通常即时通过。
          {status && (
            <span className="mt-1 block">
              {statusRow(
                status.tmdbConfigured,
                "已配置，首页电影/剧集已切换 TMDB 热门（动漫使用 Bangumi）",
                "未配置，首页使用 NeoDB 热门作为后备",
              )}
            </span>
          )}
        </p>
        <label className="block text-sm">
          <span className="mb-1 flex items-center justify-between text-zinc-400">
            API Key（TMDB）
            <button
              type="button"
              onClick={() => toggleKey("tmdb")}
              className="text-xs text-zinc-500 hover:text-zinc-300"
            >
              {showKeys.tmdb ? "🙈 隐藏" : "👁 显示"}
            </button>
          </span>
          <input
            value={tmdbKey}
            onChange={(e) => {
              setTmdbKey(e.target.value);
              markDirty("tmdb");
            }}
            placeholder={
              status?.tmdbConfigured
                ? "已配置，留空保持不变"
                : "1234567890abcdef..."
            }
            type={showKeys.tmdb ? "text" : "password"}
            className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-amber-500 focus:outline-none"
          />
        </label>
        <button
          type="button"
          onClick={() =>
            dirty.tmdb
              ? saveFields({ tmdbApiKey: tmdbKey }, ["tmdb"])
              : setMessage("没有需要保存的更改")
          }
          disabled={busy}
          className="mt-3 rounded-lg bg-amber-500 px-4 py-2 text-sm font-medium text-zinc-950 transition hover:bg-amber-400 disabled:opacity-50"
        >
          保存 TMDB Key
        </button>
      </div>

      <div className="mb-6 rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5">
        <h2 className="mb-2 font-medium text-zinc-100">
          ④ OMDb API Key（IMDb 评分）
        </h2>
        <p className="mb-3 text-xs text-zinc-500">
          IMDb 官方没有开放 API，用 OMDb 代理显示 IMDb 评分。在{" "}
          <a
            href="https://www.omdbapi.com/apikey.aspx"
            target="_blank"
            rel="noreferrer"
            className="text-amber-400 hover:underline"
          >
            omdbapi.com
          </a>{" "}
          用邮箱免费申请 Key（Free tier 即可）。可选，不填则只保留 IMDb 链接。
          {status && (
            <span className="mt-1 block">
              {statusRow(
                status.omdbConfigured,
                "已配置，详情页将显示 IMDb 评分",
                "未配置",
              )}
            </span>
          )}
        </p>
        <label className="block text-sm">
          <span className="mb-1 flex items-center justify-between text-zinc-400">
            OMDb API Key
            <button
              type="button"
              onClick={() => toggleKey("omdb")}
              className="text-xs text-zinc-500 hover:text-zinc-300"
            >
              {showKeys.omdb ? "🙈 隐藏" : "👁 显示"}
            </button>
          </span>
          <input
            value={omdbKey}
            onChange={(e) => {
              setOmdbKey(e.target.value);
              markDirty("omdb");
            }}
            placeholder={
              status?.omdbConfigured ? "已配置，留空保持不变" : "xxxxxxxx"
            }
            type={showKeys.omdb ? "text" : "password"}
            className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-amber-500 focus:outline-none"
          />
        </label>
        <button
          type="button"
          onClick={() =>
            dirty.omdb
              ? saveFields({ omdbApiKey: omdbKey }, ["omdb"])
              : setMessage("没有需要保存的更改")
          }
          disabled={busy}
          className="mt-3 rounded-lg bg-amber-500 px-4 py-2 text-sm font-medium text-zinc-950 transition hover:bg-amber-400 disabled:opacity-50"
        >
          保存 OMDb Key
        </button>
      </div>

      <div className="mb-6 rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5">
        <h2 className="mb-2 font-medium text-zinc-100">
          ⑤ AI API Key（AI 推荐）
        </h2>
        <p className="mb-3 text-xs text-zinc-500">
          填入你自己的 AI 接口 Key（OpenAI、DeepSeek 或任何 OpenAI 兼容接口），
          首页即可让 AI 根据你的 NeoDB 已标记记录生成推荐。可选。
          注意：OpenAI 的 Key 只能配 OpenAI 地址，DeepSeek 的 Key 只能配
          DeepSeek 地址，混用会提示 401。点「刷新模型列表」可以测试 Key 是否有效。
          {status && (
            <span className="mt-1 block">
              {statusRow(
                status.aiConfigured,
                `已配置（${status.aiModel || "默认模型"}）`,
                "未配置",
              )}
            </span>
          )}
        </p>
        <div className="mb-3 flex flex-wrap gap-1.5">
          {AI_PRESETS.map((p) => (
            <button
              key={p.name}
              type="button"
              onClick={() => {
                setAiBaseUrl(p.base);
                setAiModel(p.model);
                markDirty("aiBaseUrl");
                markDirty("aiModel");
              }}
              className={`rounded-full border px-2.5 py-1 text-xs transition ${
                activePreset?.name === p.name
                  ? "border-amber-400/60 bg-amber-500/10 text-amber-300"
                  : "border-zinc-700 text-zinc-300 hover:border-teal-400/60 hover:text-teal-200"
              }`}
            >
              {p.name}
            </button>
          ))}
          <span className="self-center text-[11px] text-zinc-600">
            点选预设自动填好 API 地址
          </span>
        </div>
        <label className="mb-2 block text-sm">
          <span className="mb-1 flex items-center justify-between text-zinc-400">
            API Key（AI）
            <button
              type="button"
              onClick={() => toggleKey("ai")}
              className="text-xs text-zinc-500 hover:text-zinc-300"
            >
              {showKeys.ai ? "🙈 隐藏" : "👁 显示"}
            </button>
          </span>
          <input
            value={aiKey}
            onChange={(e) => {
              setAiKey(e.target.value);
              markDirty("ai");
            }}
            placeholder={
              status?.aiConfigured ? "已配置，留空保持不变" : "sk-..."
            }
            type={showKeys.ai ? "text" : "password"}
            className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-teal-400 focus:outline-none"
          />
        </label>
        <label className="mb-2 block text-sm">
          <span className="mb-1 block text-zinc-400">
            Base URL（可选，默认 https://api.openai.com/v1）
          </span>
          <input
            value={aiBaseUrl}
            onChange={(e) => {
              setAiBaseUrl(e.target.value);
              markDirty("aiBaseUrl");
            }}
            placeholder="https://api.openai.com/v1"
            className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-teal-400 focus:outline-none"
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 flex items-center gap-2 text-zinc-400">
            模型名（可选）
            <button
              type="button"
              onClick={fetchModels}
              disabled={busy}
              className="rounded-md border border-zinc-700 px-2 py-0.5 text-[11px] text-zinc-300 transition hover:border-teal-400/60 hover:text-teal-200 disabled:opacity-50"
            >
              刷新模型列表
            </button>
          </span>
          {models.length > 0 && !customModel ? (
            <select
              value={aiModel}
              onChange={(e) => {
                if (e.target.value === "__custom__") {
                  setCustomModel(true);
                  setAiModel("");
                } else {
                  setAiModel(e.target.value);
                }
                markDirty("aiModel");
              }}
              className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 focus:border-teal-400 focus:outline-none"
            >
              {models.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
              <option value="__custom__">自定义模型…</option>
            </select>
          ) : (
            <input
              value={aiModel}
              onChange={(e) => {
                setAiModel(e.target.value);
                markDirty("aiModel");
              }}
              placeholder="gpt-4o-mini"
              className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-teal-400 focus:outline-none"
            />
          )}
        </label>
        <button
          type="button"
          onClick={() =>
            saveFields(
              {
                ...(dirty.ai ? { aiApiKey: aiKey } : {}),
                ...(dirty.aiBaseUrl ? { aiBaseUrl } : {}),
                ...(dirty.aiModel ? { aiModel } : {}),
              },
              ["ai", "aiBaseUrl", "aiModel"],
            )
          }
          disabled={busy}
          className="mt-3 rounded-lg bg-amber-500 px-4 py-2 text-sm font-medium text-zinc-950 transition hover:bg-amber-400 disabled:opacity-50"
        >
          保存 AI 配置
        </button>
      </div>

      <div className="mb-6 rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5">
        <h2 className="mb-2 font-medium text-zinc-100">
          ⑥ 微信读书 API Key（书籍推荐）
        </h2>
        <p className="mb-3 text-xs text-zinc-500">
          填入 wrk- 开头的微信读书网关 Key 后，首页「热门书籍」会切换为微信读书
          「为你推荐」（基于你的阅读记录，含封面与评分）。可选，不填则使用 NeoDB
          书籍热门。
          {status && (
            <span className="mt-1 block">
              {statusRow(
                status.wereadConfigured,
                "已配置，首页书籍已切换微信读书推荐",
                "未配置",
              )}
            </span>
          )}
        </p>
        <label className="block text-sm">
          <span className="mb-1 flex items-center justify-between text-zinc-400">
            WEREAD_API_KEY
            <button
              type="button"
              onClick={() => toggleKey("weread")}
              className="text-xs text-zinc-500 hover:text-zinc-300"
            >
              {showKeys.weread ? "🙈 隐藏" : "👁 显示"}
            </button>
          </span>
          <input
            value={wereadKey}
            onChange={(e) => {
              setWereadKey(e.target.value);
              markDirty("weread");
            }}
            placeholder={
              status?.wereadConfigured ? "已配置，留空保持不变" : "wrk-..."
            }
            type={showKeys.weread ? "text" : "password"}
            className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-teal-400 focus:outline-none"
          />
        </label>
        <button
          type="button"
          onClick={() =>
            dirty.weread
              ? saveFields({ wereadApiKey: wereadKey }, ["weread"])
              : setMessage("没有需要保存的更改")
          }
          disabled={busy}
          className="mt-3 rounded-lg bg-amber-500 px-4 py-2 text-sm font-medium text-zinc-950 transition hover:bg-amber-400 disabled:opacity-50"
        >
          保存微信读书 Key
        </button>
      </div>

      <div className="mb-6 rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5">
        <h2 className="mb-2 font-medium text-zinc-100">⑦ 首页栏目顺序</h2>
        <p className="mb-3 text-xs text-zinc-500">
          用上下按钮调整各栏目在首页的显示顺序，保存后立即生效。
        </p>
        <ul className="space-y-1.5">
          {orderList.map((k, i) => (
            <li
              key={k}
              className="flex items-center justify-between rounded-lg border border-white/5 bg-zinc-900/40 px-3 py-2"
            >
              <span className="text-sm text-zinc-200">
                {SECTION_NAMES[k] ?? k}
              </span>
              <span className="flex gap-1">
                <button
                  type="button"
                  onClick={() => moveSection(i, -1)}
                  disabled={i === 0}
                  className="rounded-md border border-zinc-700 px-2 py-0.5 text-xs text-zinc-300 transition hover:border-amber-400/50 disabled:opacity-30"
                >
                  ↑
                </button>
                <button
                  type="button"
                  onClick={() => moveSection(i, 1)}
                  disabled={i === orderList.length - 1}
                  className="rounded-md border border-zinc-700 px-2 py-0.5 text-xs text-zinc-300 transition hover:border-amber-400/50 disabled:opacity-30"
                >
                  ↓
                </button>
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-zinc-500">
          ⭐ 主题会自动跟随系统：日间为米白星辰金（方案A），夜间为夜空深蓝星光金（方案B），无需手动切换。
        </p>
        <button
          type="button"
          onClick={() =>
            saveFields({ sectionOrder: orderList }, ["order"])
          }
          disabled={busy}
          className="mt-3 rounded-lg bg-amber-500 px-4 py-2 text-sm font-medium text-zinc-950 transition hover:bg-amber-400 disabled:opacity-50"
        >
          保存栏目顺序
        </button>
      </div>
      <div className="mb-6 rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5">
        <h2 className="mb-2 font-medium text-zinc-100">
          ⑦ 本地 ↔ NeoDB 数据桥接
        </h2>
        <p className="mb-3 text-xs text-zinc-500">
          本地标记是给不使用 NeoDB 的朋友准备的：可把自己在 NeoDB 的整个书架导入成本地标记（随备份一起加密同步），也可把本地标记一次性同步回 NeoDB。需要先完成 NeoDB 账号授权。
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void runBridge("import")}
            disabled={bridgeBusy !== null}
            className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-medium text-zinc-950 transition hover:bg-amber-400 disabled:opacity-50"
          >
            {bridgeBusy === "import" ? "导入中…" : "从 NeoDB 导入到本地"}
          </button>
          <button
            type="button"
            onClick={() => void runBridge("export")}
            disabled={bridgeBusy !== null}
            className="rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-300 transition hover:border-amber-400/50 disabled:opacity-50"
          >
            {bridgeBusy === "export" ? "导出中…" : "导出本地标记到 NeoDB"}
          </button>
        </div>
        {bridgeMsg && (
          <p className="mt-3 text-sm text-emerald-400">{bridgeMsg}</p>
        )}
        {bridgeError && (
          <p className="mt-3 text-sm text-red-400">{bridgeError}</p>
        )}
      </div>
      <div className="mb-6 rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5">
        <h2 className="mb-2 font-medium text-zinc-100">
          ⑧ 数据备份（加密导出 / 导入 / WebDAV 同步）
        </h2>
        <p className="mb-3 text-xs text-zinc-500">
          用密码（AES 加密）备份所有 Key 配置、本地档案（头像 / 昵称）与本地标记，
          可导出文件或同步到自己的 WebDAV（如坚果云）。密码只在本机浏览器里使用，不会上传。
        </p>
        <label className="mb-3 block text-sm">
          <span className="mb-1 flex items-center justify-between text-zinc-400">
            备份密码
            <button
              type="button"
              onClick={() => toggleKey("backup")}
              className="text-xs text-zinc-500 hover:text-zinc-300"
            >
              {showKeys.backup ? "🙈 隐藏" : "👁 显示"}
            </button>
          </span>
          <input
            value={backupPassword}
            onChange={(e) => {
              setBackupPassword(e.target.value);
              try {
                localStorage.setItem("shibei-backup-pass", e.target.value);
              } catch {
                // 忽略
              }
            }}
            type={showKeys.backup ? "text" : "password"}
            placeholder="设置/输入备份密码"
            className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-teal-400 focus:outline-none"
          />
        </label>
        <div className="mb-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={exportBackup}
            className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-medium text-zinc-950 transition hover:bg-amber-400"
          >
            导出加密备份
          </button>
          <label className="cursor-pointer rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-300 transition hover:border-amber-400/50">
            导入备份
            <input
              type="file"
              accept=".txt,.json"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) importBackup(f);
                e.target.value = "";
              }}
            />
          </label>
        </div>
        <div className="mb-3 grid gap-2 sm:grid-cols-3">
          <div className="sm:col-span-3">
            <button
              type="button"
              onClick={() => {
                setWebdavUrl(
                  "https://dav.jianguoyun.com/dav/cangxing/cangxing-backup.txt",
                );
                markDirty("webdavUrl");
              }}
              className="text-xs text-teal-300 hover:underline"
            >
              一键填入坚果云地址（dav.jianguoyun.com/dav/cangxing/cangxing-backup.txt）
            </button>
          </div>
          <input
            value={webdavUrl}
            onChange={(e) => {
              setWebdavUrl(e.target.value);
              markDirty("webdavUrl");
            }}
            placeholder="WebDAV 地址（指向一个文件，会自动补文件名）"
            className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-teal-400 focus:outline-none"
          />
          <input
            value={webdavUser}
            onChange={(e) => {
              setWebdavUser(e.target.value);
              markDirty("webdavUser");
            }}
            placeholder="WebDAV 用户名"
            className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-teal-400 focus:outline-none"
          />
          <div className="relative">
            <input
              value={webdavPass}
              onChange={(e) => {
                setWebdavPass(e.target.value);
                markDirty("webdavPass");
              }}
              type={showKeys.webdav ? "text" : "password"}
              placeholder="WebDAV 密码"
              className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 pr-10 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-teal-400 focus:outline-none"
            />
            <button
              type="button"
              onClick={() => toggleKey("webdav")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-zinc-500 hover:text-zinc-300"
            >
              {showKeys.webdav ? "🙈" : "👁"}
            </button>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() =>
              saveFields(
                {
                  ...(dirty.webdavUrl ? { webdavUrl } : {}),
                  ...(dirty.webdavUser ? { webdavUser } : {}),
                  ...(dirty.webdavPass ? { webdavPass } : {}),
                },
                ["webdavUrl", "webdavUser", "webdavPass"],
              )
            }
            disabled={busy}
            className="rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-300 transition hover:border-amber-400/50 disabled:opacity-50"
          >
            保存 WebDAV 配置
          </button>
          <button
            type="button"
            onClick={webdavUpload}
            className="rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-300 transition hover:border-amber-400/50"
          >
            加密上传到 WebDAV
          </button>
          <button
            type="button"
            onClick={webdavDownload}
            className="rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-300 transition hover:border-amber-400/50"
          >
            从 WebDAV 下载恢复
          </button>
        </div>
        {backupMsg && (
          <p className="mt-3 text-sm text-emerald-400">{backupMsg}</p>
        )}
        {backupError && (
          <p className="mt-3 text-sm text-red-400">{backupError}</p>
        )}
      </div>
      <div className="mb-6 rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5">
        <h2 className="mb-2 font-medium text-zinc-100">
          ⑨ 局域网访问与开机自启
        </h2>
        <p className="mb-4 text-xs text-zinc-500">
          开启局域网访问后，同一 Wi-Fi / 局域网内的手机、平板等设备可用{" "}
          <code className="text-teal-300">
            http://本机IP:{sysConfig?.port ?? 3210}
          </code>{" "}
          访问本应用；开启开机自启后，电脑启动时会自动运行本程序，方便随时用其他设备访问。
        </p>
        <div className="mb-3 flex items-center justify-between gap-3 rounded-xl border border-zinc-800 bg-zinc-950/40 px-4 py-3">
          <div>
            <p className="text-sm text-zinc-200">开机自启</p>
            <p className="text-xs text-zinc-500">随电脑启动自动运行藏星</p>
          </div>
          <Switch
            checked={sysConfig?.autoLaunch ?? false}
            disabled={sysBusy}
            onChange={(v) => updateSysConfig({ autoLaunch: v })}
          />
        </div>
        <div className="mb-3 flex items-center justify-between gap-3 rounded-xl border border-zinc-800 bg-zinc-950/40 px-4 py-3">
          <div>
            <p className="text-sm text-zinc-200">局域网访问</p>
            <p className="text-xs text-zinc-500">
              允许同一局域网内的其他设备访问本机服务
            </p>
          </div>
          <Switch
            checked={sysConfig?.lanMode ?? false}
            disabled={sysBusy}
            onChange={(v) => updateSysConfig({ lanMode: v })}
          />
        </div>
        {sysConfig?.lanMode && (
          <div className="mb-3 rounded-xl border border-teal-500/20 bg-teal-500/5 px-4 py-3">
            <p className="mb-1 text-xs text-zinc-400">局域网访问地址：</p>
            <div className="flex flex-wrap gap-2">
              {(sysConfig.lanUrls.length > 0
                ? sysConfig.lanUrls
                : [`http://本机IP:${sysConfig.port}`]
              ).map((url) => (
                <a
                  key={url}
                  href={url}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-md bg-zinc-800 px-2.5 py-1 font-mono text-xs text-teal-300 hover:bg-zinc-700"
                >
                  {url}
                </a>
              ))}
            </div>
            <p className="mt-2 text-xs text-zinc-500">
              手机无法访问时，请检查 Windows 防火墙是否放行藏星（专用网络）；
              本应用没有登录密码，请仅在可信局域网内开启。
            </p>
          </div>
        )}
        <p className="text-xs text-zinc-500">
          说明：NeoDB 连接（授权登录）请在本机完成；局域网设备默认可以浏览与检索，不需要登录。
        </p>
      </div>
      <div className="mb-6 rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5">
        <h2 className="mb-2 font-medium text-zinc-100">⑩ 标题修正</h2>
        <p className="mb-3 text-xs text-zinc-500">
          某些作品的官方译名与 NeoDB 显示不一致时（如《巅峰对决》显示为《激烈竞争》），
          可在此把原名修正为正确译名，首页和详情页都会生效。
        </p>
        <div className="space-y-2">
          {overridesList.map((row, i) => (
            <div key={i} className="flex gap-2">
              <input
                value={row.orig}
                onChange={(e) => {
                  const next = [...overridesList];
                  next[i] = { ...next[i], orig: e.target.value };
                  setOverridesList(next);
                  markDirty("titleOverrides");
                }}
                placeholder="原名（当前显示的名称）"
                className="w-1/2 rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-teal-400 focus:outline-none"
              />
              <input
                value={row.fixed}
                onChange={(e) => {
                  const next = [...overridesList];
                  next[i] = { ...next[i], fixed: e.target.value };
                  setOverridesList(next);
                  markDirty("titleOverrides");
                }}
                placeholder="修正为"
                className="w-1/2 rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-teal-400 focus:outline-none"
              />
              <button
                type="button"
                onClick={() => {
                  setOverridesList((prev) =>
                    prev.filter((_, idx) => idx !== i),
                  );
                  markDirty("titleOverrides");
                }}
                className="shrink-0 rounded-lg border border-zinc-700 px-3 text-sm text-zinc-400 hover:border-red-500/50 hover:text-red-300"
              >
                删
              </button>
            </div>
          ))}
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => {
              setOverridesList((prev) => [...prev, { orig: "", fixed: "" }]);
              markDirty("titleOverrides");
            }}
            className="rounded-lg border border-zinc-700 px-3 py-2 text-sm text-zinc-300 hover:border-teal-400/50"
          >
            添加一行
          </button>
          <button
            type="button"
            onClick={() => {
              const obj: Record<string, string> = {};
              for (const row of overridesList) {
                if (row.orig.trim() && row.fixed.trim()) {
                  obj[normalizeTitle(row.orig.trim())] = row.fixed.trim();
                }
              }
              saveFields({ titleOverrides: obj }, ["titleOverrides"]);
            }}
            disabled={busy}
            className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-medium text-zinc-950 transition hover:bg-amber-400 disabled:opacity-50"
          >
            保存标题修正
          </button>
        </div>
      </div>
      {message && <p className="mt-3 text-sm text-emerald-400">{message}</p>}
      {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
    </div>
  );
}
