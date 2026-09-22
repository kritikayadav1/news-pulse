import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { fileURLToPath } from "node:url";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, root, "");
  return {
    plugins: [react()],
    envDir: root,
    server: {
      port: 5173,
      strictPort: true,
      proxy: { "/api": `http://127.0.0.1:${env.PORT || 3001}` },
    },
  };
});
