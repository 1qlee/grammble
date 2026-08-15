import { existsSync, readFileSync } from "node:fs";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import { defineConfig } from "vite";
import tsConfigPaths from "vite-tsconfig-paths";
import viteReact from "@vitejs/plugin-react";
import { visualizer } from "rollup-plugin-visualizer";

// Opt-in HTTPS for dev (set HTTPS=true) using locally-trusted mkcert certs, so
// secure-context features (clipboard image writes) work when testing on LAN
// devices. Plain `pnpm dev` stays HTTP. Generate certs with:
//   mkcert -cert-file certs/cert.pem -key-file certs/key.pem localhost 127.0.0.1 ::1 <LAN-IP>
const certPath = "./certs/cert.pem";
const keyPath = "./certs/key.pem";
const https =
  process.env.HTTPS === "true" && existsSync(certPath) && existsSync(keyPath)
    ? { cert: readFileSync(certPath), key: readFileSync(keyPath) }
    : undefined;

export default defineConfig({
  server: {
    port: 3000,
    host: true,
    https,
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
