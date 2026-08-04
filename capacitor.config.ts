import type { CapacitorConfig } from "@capacitor/cli";

// 手机 APK 是一个"远程壳"：直接加载桌面版在局域网提供的服务。
// 需要手机与电脑连同一 Wi-Fi，且电脑上打开「设置 → 局域网访问」。
// 若电脑 IP 变了，改这里再重新构建（或改 android/app/src/main/assets/… 的启动地址）。
const config: CapacitorConfig = {
  appId: "com.cangxing.mobile",
  appName: "藏星",
  webDir: "out",
  server: {
    url: "http://192.168.31.207:3210",
    cleartext: true,
  },
  android: {
    allowMixedContent: true,
  },
};

export default config;
