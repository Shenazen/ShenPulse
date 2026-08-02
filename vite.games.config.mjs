import { resolve } from "node:path";
import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";

export default defineConfig({
  base: "./",
  root: resolve("src/renderer/games/original-src"),
  plugins: [vue()],
  build: {
    emptyOutDir: true,
    outDir: resolve("src/renderer/games/original"),
    rollupOptions: {
      input: {
        index: resolve("src/renderer/games/original-src/index.html")
      },
      output: {
        assetFileNames: "assets/[name]-[hash][extname]",
        chunkFileNames: "assets/[name]-[hash].js",
        entryFileNames: "assets/[name]-[hash].js"
      }
    },
    target: "chrome142"
  }
});
