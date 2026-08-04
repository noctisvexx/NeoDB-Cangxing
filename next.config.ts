import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  output: "standalone",
  experimental: {
    // 详情页是动态路由，开启客户端短缓存（30 秒）后，
    // 返回/前进等重复进入同一条目不再等服务器重新渲染
    staleTimes: {
      dynamic: 30,
    },
  },
};

export default nextConfig;
