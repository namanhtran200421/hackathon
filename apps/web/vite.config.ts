/**
 * Vite builds the React page into apps/web/dist, which the Express server
 * serves. The simulation engine and worker are served separately from /sim.
 */

import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  root: import.meta.dirname,
  plugins: [react()],
  build: {
    outDir: "dist",
    emptyOutDir: true,
    chunkSizeWarningLimit: 400,
  },
});
