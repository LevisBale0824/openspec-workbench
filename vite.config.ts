import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import tailwindcss from "@tailwindcss/vite";
import { resolve } from "path";

export default defineConfig({
  root: "app",
  plugins: [vue(), tailwindcss()],
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
