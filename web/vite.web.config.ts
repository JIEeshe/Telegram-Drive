import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const shimsDir = path.resolve(__dirname, "shims");

/**
 * Web-specific Vite config
 * Aliases all @tauri-apps/* imports to our web shim implementations
 */
export default defineConfig({
  root: path.resolve(__dirname, "..", "app"),
  plugins: [react()],
  resolve: {
    alias: {
      "@tauri-apps/api/core": path.join(shimsDir, "tauri-core.ts"),
      "@tauri-apps/api": path.join(shimsDir, "tauri-core.ts"),
      "@tauri-apps/plugin-store": path.join(shimsDir, "tauri-store.ts"),
      "@tauri-apps/plugin-dialog": path.join(shimsDir, "tauri-dialog.ts"),
      "@tauri-apps/plugin-updater": path.join(shimsDir, "tauri-updater.ts"),
      "@tauri-apps/plugin-process": path.join(shimsDir, "tauri-process.ts"),
      "@tauri-apps/plugin-opener": path.join(shimsDir, "tauri-process.ts"),
    },
  },
  build: {
    outDir: path.resolve(__dirname, "dist"),
    emptyOutDir: true,
  },
  server: {
    port: 5173,
    proxy: {
      "/api": "http://localhost:3210",
      "/stream": "http://localhost:3210",
    },
  },
});
