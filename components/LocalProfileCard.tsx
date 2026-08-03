"use client";

import { useEffect, useRef, useState } from "react";

interface Profile {
  nickname?: string;
  avatar?: string;
}

function compressImage(
  file: File,
  maxSize: number,
  quality: number,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(img.width * scale));
        canvas.height = Math.max(1, Math.round(img.height * scale));
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("无法处理图片"));
          return;
        }
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.onerror = () => reject(new Error("图片读取失败"));
      img.src = String(reader.result);
    };
    reader.onerror = () => reject(new Error("文件读取失败"));
    reader.readAsDataURL(file);
  });
}

export default function LocalProfileCard() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [editing, setEditing] = useState(false);
  const [nickname, setNickname] = useState("");
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch("/api/profile")
      .then((r) => r.json())
      .then((data: Profile) => setProfile(data))
      .catch(() => setProfile({}));
  }, []);

  function startEdit() {
    setNickname(profile?.nickname ?? "");
    setAvatarPreview(profile?.avatar ?? null);
    setMsg(null);
    setErr(null);
    setEditing(true);
  }

  async function onFile(file: File | undefined) {
    if (!file) return;
    setErr(null);
    try {
      const dataUrl = await compressImage(file, 512, 0.82);
      setAvatarPreview(dataUrl);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "图片处理失败");
    }
  }

  async function save() {
    setBusy(true);
    setMsg(null);
    setErr(null);
    try {
      const res = await fetch("/api/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nickname, avatar: avatarPreview ?? "" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "保存失败");
      setProfile(data);
      setEditing(false);
      setMsg("本地档案已保存（头像与昵称随备份一起加密同步）");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "保存失败");
    } finally {
      setBusy(false);
    }
  }

  const avatarSrc = avatarPreview ?? profile?.avatar;

  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4">
      <div className="mb-3 flex items-center gap-3">
        {avatarSrc ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={avatarSrc}
            alt="头像"
            className="h-14 w-14 rounded-full border border-zinc-700 object-cover"
          />
        ) : (
          <div
            className="flex h-14 w-14 items-center justify-center rounded-full border"
            style={{
              borderColor: "var(--border)",
              backgroundColor: "var(--accent-soft)",
              color: "var(--accent)",
            }}
          >
            <svg viewBox="0 0 24 24" className="h-7 w-7" fill="currentColor">
              <path d="M12 2c1.2 5.5 4.3 8.8 10 10-5.7 1.2-8.8 4.5-10 10-1.2-5.5-4.3-8.8-10-10 5.7-1.2 8.8-4.5 10-10Z" />
            </svg>
          </div>
        )}
        <div className="min-w-0 flex-1">
          <h2 className="title-accent text-lg font-bold">本地档案</h2>
          <p className="truncate text-sm" style={{ color: "var(--text-2)" }}>
            {profile?.nickname || "未设置昵称"} · 头像随备份加密同步
          </p>
        </div>
        {!editing && (
          <button
            type="button"
            onClick={startEdit}
            className="shrink-0 rounded-lg border border-zinc-700 px-3 py-1.5 text-sm text-zinc-300 transition hover:border-amber-400/50"
          >
            编辑
          </button>
        )}
      </div>

      {editing && (
        <div className="mt-3 space-y-3">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="rounded-lg border border-zinc-700 px-3 py-1.5 text-sm text-zinc-300 transition hover:border-amber-400/50"
            >
              选择头像
            </button>
            {avatarPreview && (
              <button
                type="button"
                onClick={() => setAvatarPreview("")}
                className="text-sm text-zinc-500 hover:text-red-400"
              >
                移除头像
              </button>
            )}
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => void onFile(e.target.files?.[0])}
            />
          </div>
          <label className="block text-sm">
            <span className="mb-1 block text-zinc-400">昵称</span>
            <input
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              maxLength={30}
              placeholder="朋友看到的名字（局域网共享时展示）"
              className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-amber-500 focus:outline-none"
            />
          </label>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => void save()}
              disabled={busy}
              className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-medium text-zinc-950 transition hover:bg-amber-400 disabled:opacity-50"
            >
              {busy ? "保存中…" : "保存"}
            </button>
            <button
              type="button"
              onClick={() => setEditing(false)}
              disabled={busy}
              className="rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-300 transition hover:border-zinc-500 disabled:opacity-50"
            >
              取消
            </button>
          </div>
        </div>
      )}

      {msg && <p className="mt-3 text-sm text-emerald-400">{msg}</p>}
      {err && <p className="mt-3 text-sm text-red-400">{err}</p>}
    </div>
  );
}
