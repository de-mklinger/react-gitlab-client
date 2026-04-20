import react from "@vitejs/plugin-react";
import { resolve } from "node:path";
import { defineConfig } from "vite";
import dts from "vite-plugin-dts";

export default defineConfig({
  plugins: [
    react(),
    dts({
      include: "./src/lib",
      tsconfigPath: "./tsconfig.app.json",
      rollupTypes: true,
    }),
  ],
  build: {
    lib: {
      entry: resolve(__dirname, "./src/lib/index.ts"),
      formats: ["es"],
    },
    rolldownOptions: {
      external: [
        "react",
        "react/jsx-runtime",
        "react-dom",
        "oidc-client-ts",
        "react-oidc-context",
      ],
    },
  },
});
