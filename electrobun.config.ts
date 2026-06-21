import type { ElectrobunConfig } from "electrobun";

export default {
  app: {
    name: "scheduline",
    identifier: "scheduline.electrobun.dev",
    version: "0.0.1",
  },
  build: {
    // Vite builds to dist/, we copy from there
    copy: {
      "dist/index.html": "views/mainview/index.html",
      "dist/assets": "views/mainview/assets",
    },
    watchIgnore: ["dist/**"],
    linux: {
      bundleCEF: false,
      icon: "./assets/icon.png",
    },
    win: {
      bundleCEF: false,
      icon: "./assets/icon.ico",
    },
  },
  release: {
    baseUrl: "https://github.com/chi1180/scheduline/releases/latest/download",
  },
} satisfies ElectrobunConfig;
