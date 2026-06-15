import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import { defineConfig } from "vite";
import tsConfigPaths from "vite-tsconfig-paths";
import viteReact from "@vitejs/plugin-react";
import { visualizer } from "rollup-plugin-visualizer";

export default defineConfig({
  server: {
    port: 3000,
  },
  plugins: [
    tsConfigPaths({
      projects: ["./tsconfig.json"],
    }),
    tanstackStart(),
    viteReact(),
    process.env.ANALYZE
      ? {
          ...visualizer({
            filename: `dist/stats-${process.env.ANALYZE_ENV ?? "client"}.json`,
            template: "raw-data",
            gzipSize: true,
            brotliSize: true,
            emitFile: false,
          }),
          applyToEnvironment(env: { name: string }) {
            if (process.env.ANALYZE_ENV) {
              return env.name === process.env.ANALYZE_ENV;
            }
            return env.name === "client";
          },
        }
      : null,
  ].filter(Boolean),
});
