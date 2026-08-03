import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

const DEFAULT_PORT =
  process.env.NODE_ENV === "development" ? 3000 : 3210;
const PORT = Number(process.env.PORT) || DEFAULT_PORT;

interface SystemConfig {
  lanMode: boolean;
  autoLaunch: boolean;
}

function configFilePath(): string {
  const root = process.env.CANGXING_DATA_DIR || process.cwd();
  return path.join(root, "app-config.json");
}

async function readConfig(): Promise<SystemConfig> {
  try {
    const raw = await fs.readFile(configFilePath(), "utf8");
    const parsed = JSON.parse(raw) as Partial<SystemConfig>;
    return {
      lanMode: !!parsed.lanMode,
      autoLaunch: !!parsed.autoLaunch,
    };
  } catch {
    return { lanMode: false, autoLaunch: false };
  }
}

function lanAddresses(): string[] {
  const out: string[] = [];
  for (const ifaces of Object.values(os.networkInterfaces())) {
    for (const iface of ifaces ?? []) {
      if (iface.family === "IPv4" && !iface.internal) {
        out.push(iface.address);
      }
    }
  }
  return [...new Set(out)];
}

function lanUrls(config: SystemConfig): string[] {
  if (!config.lanMode) return [];
  return lanAddresses().map((ip) => `http://${ip}:${PORT}`);
}

export async function GET() {
  const config = await readConfig();
  return NextResponse.json({
    ...config,
    port: PORT,
    lanUrls: lanUrls(config),
  });
}

export async function POST(req: NextRequest) {
  let body: { lanMode?: unknown; autoLaunch?: unknown } = {};
  try {
    body = await req.json();
  } catch {
    // 忽略
  }
  const current = await readConfig();
  const next: SystemConfig = {
    lanMode:
      typeof body.lanMode === "boolean"
        ? body.lanMode
        : current.lanMode,
    autoLaunch:
      typeof body.autoLaunch === "boolean"
        ? body.autoLaunch
        : current.autoLaunch,
  };
  await fs.mkdir(path.dirname(configFilePath()), { recursive: true });
  await fs.writeFile(
    configFilePath(),
    JSON.stringify(next, null, 2),
    "utf8",
  );
  return NextResponse.json({
    ...next,
    port: PORT,
    lanUrls: lanUrls(next),
  });
}
