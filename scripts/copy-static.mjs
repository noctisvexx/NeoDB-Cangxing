// 把静态资源拷入 Next standalone 输出目录，供 Electron 打包使用
// 同时清理可能混入 standalone 的运行时/旧构建垃圾，避免它们被一起打进安装包
import { cpSync, mkdirSync, rmSync } from "node:fs";
import path from "node:path";

const standalone = path.resolve(".next/standalone");

// 以下目录/文件不属于 Next 产物：
// - dist/          历史版本 electron-builder 误把输出写进 standalone 的嵌套垃圾
// - data/          运行时数据（缓存/设置）意外落在 cwd 的残留
// - app-config.json 运行时配置意外落在 cwd 的残留
const junk = ["dist", "data", "app-config.json"];
for (const name of junk) {
  rmSync(path.join(standalone, name), { recursive: true, force: true });
}

mkdirSync(`${standalone}/.next`, { recursive: true });
cpSync(".next/static", `${standalone}/.next/static`, { recursive: true });
mkdirSync(`${standalone}/public`, { recursive: true });
cpSync("public", `${standalone}/public`, { recursive: true });
cpSync("app/icon.svg", `${standalone}/public/icon.svg`);
console.log("静态资源已复制到 .next/standalone（已清理旧构建/运行时残留）");