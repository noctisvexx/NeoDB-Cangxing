import Link from "next/link";
import ItemCard from "@/components/ItemCard";
import CoverCard from "@/components/CoverCard";
import Heatmap from "@/components/Heatmap";
import AiProfile from "@/components/AiProfile";
import ConnectNeoDB from "@/components/ConnectNeoDB";
import LocalProfileCard from "@/components/LocalProfileCard";
import LocalBridge from "@/components/LocalBridge";
import { neoDbClientId, neoDbInstance, neoDbToken } from "@/lib/config";
import { getMe, getShelf } from "@/lib/neodb";
import { loadAuthFile } from "@/lib/neodb-auth";
import { loadMarks } from "@/lib/local-marks";
import type { LocalMark } from "@/lib/local-marks";
import {
  CATEGORY_META,
  SHELF_LABELS,
  shelfLabelsFor,
} from "@/lib/categories";
import type { NeoDBMark, ShelfType } from "@/lib/types";
import { compactItem, localMarkToItem } from "@/lib/utils";

export const dynamic = "force-dynamic";

function OAuthButton({
  label,
  clientIdConfigured,
}: {
  label: string;
  clientIdConfigured: boolean;
}) {
  if (!clientIdConfigured) return null;
  return (
    <a
      href="/api/auth/neodb"
      className="inline-block rounded-lg bg-amber-500 px-4 py-2 text-sm font-medium text-zinc-950 transition hover:bg-amber-400"
    >
      {label}
    </a>
  );
}

function SetupGuide({
  clientIdConfigured,
}: {
  clientIdConfigured: boolean;
}) {
  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-10">
      <h1 className="title-accent mb-4 text-2xl font-bold">我的</h1>
      <div className="rounded-2xl border border-white/5 bg-zinc-900/60 p-6">
        <h2 className="mb-3 font-medium">还没有连接 NeoDB 账号</h2>
        <div className="mb-5 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4">
          <p className="mb-2 text-sm font-medium text-amber-300">
            推荐方式：OAuth 连接（一年期令牌，可读写）
          </p>
          {clientIdConfigured ? (
            <OAuthButton label="连接到 NeoDB" clientIdConfigured />
          ) : (
            <div>
              <p className="mb-2 text-sm text-zinc-300">
                无需手动创建应用，点下面按钮自动完成：
              </p>
              <ConnectNeoDB label="一键创建应用并连接 NeoDB" />
              <details className="mt-3 text-xs text-zinc-500">
                <summary className="cursor-pointer hover:text-zinc-300">
                  高级：手动填写 Client ID / Secret
                </summary>
                <p className="mt-2">
                  也可在{" "}
                  <Link
                    href="/settings"
                    className="text-amber-400 hover:underline"
                  >
                    设置页
                  </Link>{" "}
                  手动填写应用凭据（需先在 NeoDB 开发者页新增应用，Redirect
                   URI 填 http://localhost:3210/api/auth/callback）。
                </p>
              </details>
            </div>
          )}
          <p className="mt-3 text-sm text-zinc-500">
            还没有 NeoDB 账号？{" "}
            <a
              href={`${neoDbInstance()}/account/login`}
              target="_blank"
              rel="noreferrer"
              className="text-amber-400 hover:underline"
            >
              去注册
            </a>
            （登录页支持邮箱注册，也可用 Mastodon / Bluesky 登录）
          </p>
        </div>
        <details className="text-sm">
          <summary className="cursor-pointer text-zinc-400 hover:text-zinc-200">
            快速方式：手动填 Test Access Token（只读，仅临时试用）
          </summary>
          <ol className="mt-2 list-decimal space-y-1.5 pl-5 text-zinc-500">
            <li>
              打开{" "}
              <a
                href="https://neodb.social/developer/"
                target="_blank"
                rel="noreferrer"
                className="text-amber-400 hover:underline"
              >
                neodb.social/developer
              </a>{" "}
              登录生成 Test Access Token；
            </li>
            <li>
              填入 <code className="rounded bg-zinc-800 px-1.5 py-0.5 text-zinc-400">.env.local</code> 的{" "}
              <code className="rounded bg-zinc-800 px-1.5 py-0.5 text-zinc-400">NEO_DB_ACCESS_TOKEN</code> 并重启。
            </li>
          </ol>
        </details>
        <p className="mt-4 text-xs text-zinc-600">
          令牌只保存在本地，用于读取你的书架与写入收藏。
        </p>
      </div>
    </div>
  );
}

function StatCard({
  label,
  count,
  href,
}: {
  label: string;
  count?: number;
  href?: string;
}) {
  const inner = (
    <>
      <p className="text-sm text-zinc-500">{label}</p>
      <p className="mt-1 text-2xl font-bold">{count ?? "—"}</p>
    </>
  );
  if (href) {
    return (
      <Link
        href={href}
        className="block rounded-2xl border border-white/5 bg-zinc-900/60 p-4 transition hover:border-amber-400/40"
      >
        {inner}
      </Link>
    );
  }
  return (
    <div className="rounded-2xl border border-white/5 bg-zinc-900/60 p-4">
      {inner}
    </div>
  );
}

const LOCAL_SHELF_ORDER: ShelfType[] = [
  "wishlist",
  "progress",
  "complete",
  "dropped",
];

function LocalMarksSections({ marks }: { marks: LocalMark[] }) {
  const byShelf = new Map<ShelfType, LocalMark[]>();
  for (const m of marks) {
    if (!byShelf.has(m.shelf)) byShelf.set(m.shelf, []);
    byShelf.get(m.shelf)?.push(m);
  }
  return (
    <>
      {LOCAL_SHELF_ORDER.filter((s) => byShelf.has(s)).map((shelf) => {
        const items = byShelf.get(shelf) ?? [];
        const categories = [
          ...new Set(
            items
              .map((i) => i.category)
              .filter((c): c is string => !!c),
          ),
        ];
        const title =
          categories.length === 1
            ? shelfLabelsFor(categories[0])[shelf]
            : SHELF_LABELS[shelf];
        return (
          <section key={shelf} className="mb-8">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="title-accent text-xl font-bold">{title}</h2>
              <Link
                href={`/me/all?source=local&shelf=${shelf}`}
                className="text-sm text-amber-400 hover:underline"
              >
                查看全部 →
              </Link>
            </div>
            <div className="flex gap-3 overflow-x-auto pb-2">
              {items.slice(0, 20).map((m) => (
                <div key={m.id} className="w-36 shrink-0">
                  <CoverCard item={localMarkToItem(m)} />
                </div>
              ))}
            </div>
          </section>
        );
      })}
    </>
  );
}

async function LocalModePage({
  clientIdConfigured,
}: {
  clientIdConfigured: boolean;
}) {
  const marks = await loadMarks().catch(() => []);
  const countByShelf = (shelf: ShelfType) =>
    marks.filter((m) => m.shelf === shelf).length;
  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8">
      <h1 className="title-accent mb-4 text-2xl font-bold">我的</h1>
      <LocalProfileCard />
      <div className="mb-4 mt-4 grid grid-cols-3 gap-3">
        <StatCard
          label="想看"
          count={countByShelf("wishlist")}
          href="/me/all?source=local&shelf=wishlist"
        />
        <StatCard
          label="在看"
          count={countByShelf("progress")}
          href="/me/all?source=local&shelf=progress"
        />
        <StatCard
          label="已看"
          count={countByShelf("complete")}
          href="/me/all?source=local&shelf=complete"
        />
      </div>
      <div className="mb-4 rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5">
        <h2 className="title-accent mb-2 text-lg font-bold">本地模式</h2>
        <p className="mb-3 text-sm text-zinc-400">
          标记保存在本机，不依赖 NeoDB；头像与标记可一起在设置页加密备份 / 同步到
          WebDAV。NeoDB 是可选项：
        </p>
        {clientIdConfigured ? (
          <a
            href="/api/auth/neodb"
            className="inline-block rounded-lg bg-amber-500 px-4 py-2 text-sm font-medium text-zinc-950 transition hover:bg-amber-400"
          >
            连接到 NeoDB（读取 / 同步标记）
          </a>
        ) : (
          <ConnectNeoDB label="一键创建应用并连接 NeoDB（可选）" />
        )}
        <p className="mt-3 text-sm text-zinc-500">
          还没有 NeoDB 账号？{" "}
          <a
            href={`${neoDbInstance()}/account/login`}
            target="_blank"
            rel="noreferrer"
            className="text-amber-400 hover:underline"
          >
            去注册
          </a>
        </p>
      </div>
      <LocalBridge neodbConnected={false} />
      {marks.length > 0 ? (
        <LocalMarksSections marks={marks} />
      ) : (
        <div className="rounded-xl border border-dashed border-zinc-800 px-4 py-10 text-center text-sm text-zinc-500">
          本地还没有标记，去
          <Link href="/" className="mx-1 text-amber-400 hover:underline">
            发现页
          </Link>
          逛逛，详情页可以直接保存到本地档案。
        </div>
      )}
    </div>
  );
}

export default async function MePage({
  searchParams,
}: {
  searchParams: Promise<{ connected?: string; auth_error?: string }>;
}) {
  const { connected, auth_error } = await searchParams;
  const token = await neoDbToken();
  const clientIdConfigured = !!(await neoDbClientId());
  const oauthFile = await loadAuthFile();
  const oauthConnected = !!oauthFile?.access_token;

  if (!token) return <LocalModePage clientIdConfigured={clientIdConfigured} />;

  const [me, wishlist, complete, progress, extra] = await Promise.all([
    getMe().catch(() => null),
    getShelf("wishlist", 1, 12).catch(() => null),
    getShelf("complete", 1, 50).catch(() => null),
    getShelf("progress", 1, 12).catch(() => null),
    Promise.all([
      getShelf("complete", 2, 50).catch(() => null),
      getShelf("complete", 3, 50).catch(() => null),
      getShelf("complete", 4, 50).catch(() => null),
    ]),
  ]);

  const authFailed = me === null;
  const displayName = me?.display_name || me?.username || "我的";
  const seenUuid = new Set<string>();
  const allComplete: NeoDBMark[] = [];
  for (const page of [complete, ...extra]) {
    for (const m of page?.data ?? []) {
      if (!seenUuid.has(m.item.uuid)) {
        seenUuid.add(m.item.uuid);
        allComplete.push(m);
      }
    }
  }

  const counts = new Map<string, number>();
  for (const m of allComplete) {
    if (!m.created_time) continue;
    const d = new Date(m.created_time);
    const key = `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  const compactAll = allComplete.map((m) => ({
    ...m,
    item: compactItem(m.item),
  }));
  const compactWishlist = (wishlist?.data ?? []).map((m) => ({
    ...m,
    item: compactItem(m.item),
  }));

  const favorites = compactAll
    .filter((m) => m.rating_grade != null && m.rating_grade >= 9)
    .sort((a, b) => (b.rating_grade ?? 0) - (a.rating_grade ?? 0))
    .slice(0, 30);
  const disliked = compactAll
    .filter((m) => m.rating_grade != null && m.rating_grade <= 4)
    .sort((a, b) => (a.rating_grade ?? 0) - (b.rating_grade ?? 0))
    .slice(0, 30);

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8">
      {connected && (
        <div className="mb-6 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-300">
          NeoDB 授权成功，一年期 read+write 令牌已保存
        </div>
      )}
      {auth_error && (
        <div className="mb-6 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">
          NeoDB 授权失败：{auth_error}
        </div>
      )}
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="mb-1 flex items-center gap-3">
            {me && typeof me.avatar === "string" && me.avatar && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={me.avatar}
                alt=""
                className="h-12 w-12 rounded-full border border-white/10 object-cover"
              />
            )}
            <h1 className="text-2xl font-bold">{displayName}</h1>
          </div>
          <p className="text-sm text-zinc-500">
            {me && (me.display_name || me.username)
              ? `${me.display_name || me.username} · 数据来自 NeoDB`
              : "数据来自 NeoDB"}
            {" · "}
            {oauthConnected ? "OAuth 已连接" : "OAuth 未连接（当前使用环境变量令牌）"}
          </p>
        </div>
        {clientIdConfigured && (
          <a
            href="/api/auth/neodb"
            className="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs text-zinc-300 transition hover:border-zinc-500 hover:text-white"
          >
            重新连接 NeoDB
          </a>
        )}
      </div>

      {authFailed && (
        <div className="mb-6 rounded-2xl border border-red-500/30 bg-red-500/10 p-4">
          <p className="text-sm font-medium text-red-300">
            无法连接 NeoDB：令牌无效、已过期或权限不足（401）
          </p>
          <div className="mt-3">
            <OAuthButton
              label="重新连接到 NeoDB"
              clientIdConfigured={clientIdConfigured}
            />
          </div>
        </div>
      )}

      <div className="mb-8 grid grid-cols-3 gap-3">
        <StatCard
          label="想看"
          count={wishlist?.count}
          href="/me/all?kind=wishlist"
        />
        <StatCard
          label="已看"
          count={complete?.count}
          href="/me/all?kind=complete"
        />
        <StatCard
          label="在看"
          count={progress?.count}
          href="/me/all?kind=progress"
        />
      </div>

      <AiProfile />

      <section className="mb-8">
        <h2 className="title-accent mb-3 text-xl font-bold">观影热力图</h2>
        <div className="rounded-2xl border border-white/5 bg-zinc-900/60 p-4">
          <Heatmap counts={Object.fromEntries(counts)} />
        </div>
      </section>

      {favorites.length > 0 && (
        <section className="mb-8">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="title-accent text-xl font-bold">最爱榜单</h2>
            <Link
              href="/me/all?kind=favorites"
              className="text-sm text-amber-400 hover:underline"
            >
              查看全部 →
            </Link>
          </div>
          <div className="flex gap-3 overflow-x-auto pb-2">
            {favorites.map((m) => (
              <div key={m.item.uuid} className="w-36 shrink-0">
                <CoverCard item={m.item} />
              </div>
            ))}
          </div>
        </section>
      )}

      {disliked.length > 0 && (
        <section className="mb-8">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="title-accent text-xl font-bold">最讨厌榜单</h2>
            <Link
              href="/me/all?kind=disliked"
              className="text-sm text-amber-400 hover:underline"
            >
              查看全部 →
            </Link>
          </div>
          <div className="flex gap-3 overflow-x-auto pb-2">
            {disliked.map((m) => (
              <div key={m.item.uuid} className="w-36 shrink-0">
                <CoverCard item={m.item} />
              </div>
            ))}
          </div>
        </section>
      )}

      {wishlist && wishlist.data.length > 0 && (
        <section className="mb-8">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="title-accent text-xl font-bold">想看</h2>
            <Link
              href="/me/all?kind=wishlist"
              className="text-sm text-amber-400 hover:underline"
            >
              查看全部 →
            </Link>
          </div>
          <div className="flex gap-3 overflow-x-auto pb-2">
            {compactWishlist.map((m) => (
              <div key={m.item.uuid} className="w-36 shrink-0">
                <CoverCard item={m.item} />
              </div>
            ))}
          </div>
        </section>
      )}

      {(() => {
        const order = ["movie", "tv", "book", "game", "music", "podcast"];
        const grouped = new Map<string, NeoDBMark[]>();
        for (const m of compactAll) {
          const cat = m.item.category ?? "other";
          if (!grouped.has(cat)) grouped.set(cat, []);
          grouped.get(cat)?.push(m);
        }
        const cats = order.filter((c) => grouped.has(c));
        return (
          <>
            {cats.map((cat) => {
              const items = grouped.get(cat) ?? [];
              const label = CATEGORY_META[cat]?.label ?? cat;
              return (
                <section key={cat} className="mb-8">
                  <div className="mb-3 flex items-center justify-between">
                    <h2 className="title-accent text-xl font-bold">
                      最近{label}
                    </h2>
                    <Link
                      href={`/me/all?kind=${cat}`}
                      className="text-sm text-amber-400 hover:underline"
                    >
                      查看全部 →
                    </Link>
                  </div>
                  <div className="flex gap-3 overflow-x-auto pb-2">
                    {items.slice(0, 20).map((m) => (
                      <div key={m.item.uuid} className="w-36 shrink-0">
                        <CoverCard item={m.item} />
                      </div>
                    ))}
                  </div>
                </section>
              );
            })}
          </>
        );
      })()}

      {compactAll.length === 0 && !authFailed && (
        <div className="rounded-xl border border-dashed border-zinc-800 px-4 py-8 text-center text-sm text-zinc-500">
          书架上还没有标记，去
          <Link href="/" className="mx-1 text-amber-400 hover:underline">
            发现页
          </Link>
          逛逛吧。
        </div>
      )}
    </div>
  );
}
