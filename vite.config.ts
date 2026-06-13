import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import tailwindcss from "@tailwindcss/vite";
import { resolve } from "path";
import { readFileSync } from "node:fs";
import electron from "vite-plugin-electron";
import renderer from "vite-plugin-electron-renderer";

const isElectron = process.env.ELECTRON === "true";

// Copies the static CJS preload script into dist-electron (no Rollup processing).
// Preload MUST be CJS — vite-plugin-electron outputs ESM which breaks contextIsolation.
function copyStaticPreload() {
  const preloadSource = readFileSync(
    resolve(__dirname, "electron/preload.cjs"),
    "utf-8",
  );
  return {
    name: "copy-static-preload",
    generateBundle() {
      this.emitFile({
        type: "asset",
        fileName: "preload.cjs",
        source: preloadSource,
      });
    },
  };
}

export default defineConfig({
  root: "app",
  plugins: [
    vue(),
    tailwindcss(),
    ...(isElectron
      ? [
          electron({
            entry: resolve(__dirname, "electron/main.ts"),
            onstart(args) {
              // cwd must be project root so Electron finds package.json → dist-electron/main.js
              args.startup(["."], { cwd: resolve(__dirname) });
            },
            vite: {
              build: {
                outDir: resolve(__dirname, "dist-electron"),
                emptyOutDir: true,
              },
              plugins: [copyStaticPreload()],
            },
          }),
          renderer(),
        ]
      : []),
  ],
  base: "./",
  resolve: {
    alias: {
      "@": resolve(__dirname, "app"),
    },
  },
  build: {
    outDir: resolve(__dirname, "dist"),
    emptyOutDir: true,
    rollupOptions: {
      output: {
        manualChunks: {
          vue: ["vue", "vue-router", "vue-i18n"],
        },
      },
    },
    target: "es2022",
  },
  worker: {
    format: "es",
  },
  server: {
    port: 5173,
    strictPort: true,
  },
  test: {
    globals: true,
    environment: "happy-dom",
  },
});
