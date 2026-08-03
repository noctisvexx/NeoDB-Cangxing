// 本地标记库：不依赖 NeoDB 也能记录想看/想读/想听/想玩等，数据存本地 JSON
import { promises as fs } from "node:fs";
import path from "node:path";
import type { ShelfType } from "./types";

export interface LocalMark {
  id: string;
  title: string;
  category?: string;
  cover?: string;
  year?: number;
  shelf: ShelfType;
  rating?: number;
  comment?: string;
  neodbUuid?: string;
  sourceUrl?: string;
  created: string;
  updated: string;
}

let cache: LocalMark[] | null | undefined;

function marksFilePath(): string {
  const root = process.env.CANGXING_DATA_DIR || process.cwd();
  return path.join(root, "data", "local-marks.json");
}

async function readFile(): Promise<LocalMark[]> {
  try {
    const raw = await fs.readFile(marksFilePath(), "utf8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as LocalMark[]) : [];
  } catch {
    return [];
  }
}

async function writeFile(marks: LocalMark[]): Promise<void> {
  const file = marksFilePath();
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, JSON.stringify(marks, null, 2), "utf8");
  cache = marks;
}

export async function loadMarks(): Promise<LocalMark[]> {
  if (cache) return cache;
  cache = await readFile();
  return cache ?? [];
}

export async function upsertMark(
  patch: Omit<LocalMark, "id" | "created" | "updated"> & {
    id?: string;
    created?: string;
  },
): Promise<LocalMark[]> {
  const marks = await loadMarks();
  const now = new Date().toISOString();
  const id = patch.id?.trim() || `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const existing = marks.find((m) => m.id === id);
  const nextMark: LocalMark = {
    id,
    title: patch.title?.trim().slice(0, 200) || existing?.title || "未命名作品",
    category: patch.category || existing?.category,
    cover: patch.cover || existing?.cover,
    year: patch.year ?? existing?.year,
    shelf: patch.shelf,
    rating: patch.rating,
    comment:
      typeof patch.comment === "string"
        ? patch.comment.trim().slice(0, 2000) || undefined
        : existing?.comment,
    neodbUuid: patch.neodbUuid || existing?.neodbUuid,
    sourceUrl: patch.sourceUrl || existing?.sourceUrl,
    created: existing?.created || patch.created || now,
    updated: now,
  };
  const next = existing
    ? marks.map((m) => (m.id === id ? nextMark : m))
    : [...marks, nextMark];
  await writeFile(next);
  return next;
}

export async function removeMark(id: string): Promise<LocalMark[]> {
  const marks = await loadMarks();
  const next = marks.filter((m) => m.id !== id);
  await writeFile(next);
  return next;
}

export async function replaceMarks(marks: LocalMark[]): Promise<LocalMark[]> {
  const now = new Date().toISOString();
  const next = marks.map((m) => ({
    ...m,
    id: m.id?.trim() || `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    title: m.title?.trim() || "未命名作品",
    shelf: m.shelf || "wishlist",
    created: m.created || now,
    updated: m.updated || now,
  }));
  await writeFile(next);
  return next;
}
