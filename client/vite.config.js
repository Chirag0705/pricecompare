import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Dev server: HMR + React Fast Refresh out of the box.
// - strictPort: false → if 5173 is busy, Vite automatically uses the next
//   free port and prints the new URL.
// - clearScreen: false → server (nodemon) logs and compile errors stay
//   visible side by side under `npm run dev`.
export default defineConfig({
  plugins: [react()],
  clearScreen: false,
  server: {
    port: 5173,
    strictPort: false,
    proxy: {
      "/api": {
        target: "http://localhost:5000",
        changeOrigin: true,
      },
    },
  },
});
