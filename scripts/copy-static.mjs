// 把静态资源拷入 Next standalone 输出目录，供 Electron 打包使用
import { cpSync, mkdirSync } from "node:fs";

const dest = ".next/standalone";
mkdirSync(`${dest}/.next`, { recursive: true });
cpSync(".next/static", `${dest}/.next/static`, { recursive: true });
mkdirSync(`${dest}/public`, { recursive: true });
cpSync("public", `${dest}/public`, { recursive: true });
cpSync("app/icon.svg", `${dest}/public/icon.svg`);
console.log("静态资源已复制到 .next/standalone");
