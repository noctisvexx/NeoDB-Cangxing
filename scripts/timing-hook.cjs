// 启动探针：patch Module._load 记录每个模块的 require 耗时
// 用法: node -r ./scripts/timing-hook.cjs server.js
const Module = require("module");
const origLoad = Module._load;
const t0 = Date.now();
const slow = [];
const counter = { total: 0, sum: 0 };

Module._load = function (request, parent, isMain) {
  const s = Date.now();
  const r = origLoad.apply(this, arguments);
  const d = Date.now() - s;
  counter.total++;
  counter.sum += d;
  if (d >= 25) {
    slow.push({
      d,
      request,
      from: parent ? parent.filename.replace(process.cwd() + "/", "") : "main",
    });
  }
  return r;
};

function report() {
  console.log(
    `\n[hook] 启动总耗时: ${Date.now() - t0}ms | require 总次数: ${counter.total} | require 总耗时: ${counter.sum}ms`,
  );
  slow.sort((a, b) => b.d - a.d);
  console.log(`[hook] require 超过 25ms 的模块（前 50）:`);
  for (const t of slow.slice(0, 50)) {
    console.log(`  ${t.d}ms  ${t.request}  (via ${t.from})`);
  }
}

process.on("exit", report);
process.on("SIGTERM", () => {
  report();
  process.exit(0);
});
process.on("SIGINT", () => {
  report();
  process.exit(0);
});
