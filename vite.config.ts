import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { resolve } from "path";

const host = process.env.TAURI_DEV_HOST;

// `vite --mode mock`: start from the browser mock backend instead of Tauri
// (src/dev/mock). Production builds never see this.
const mockEntry = (): Plugin => ({
  name: "tembrio-mock-entry",
  transformIndexHtml: (html) =>
    html.replace("/src/main.tsx", "/src/dev/mock/entry.ts"),
});

// https://vitejs.dev/config/
export default defineConfig(async ({ mode }) => ({
  plugins: [react(), tailwindcss(), ...(mode === "mock" ? [mockEntry()] : [])],

  // Path aliases
  resolve: {
    alias: {
      "@": resolve(__dirname, "./src"),
      "@/bindings": resolve(__dirname, "./src/bindings.ts"),
    },
  },

  // Pre-bundle dependencies of the dev-only pages too (design kit, mock
  // backend). Otherwise Vite finds them on first visit and reloads the page
  // mid-test.
  optimizeDeps: {
    entries: [
      "index.html",
      "src/overlay/index.html",
      "src/kit/index.html",
      "src/dev/mock/entry.ts",
    ],
  },

  // Multiple entry points: the main app and the overlay
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, "index.html"),
        overlay: resolve(__dirname, "src/overlay/index.html"),
      },
    },
  },

  // Vite options tailored for Tauri development and only applied in `tauri dev` or `tauri build`
  //
  // 1. prevent vite from obscuring rust errors
  clearScreen: false,
  // 2. tauri expects a fixed port, fail if that port is not available
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host
      ? {
          protocol: "ws",
          host,
          port: 1421,
        }
      : undefined,
    watch: {
      // 3. tell vite to ignore watching `src-tauri`
      ignored: ["**/src-tauri/**"],
    },
  },
}));
