import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  esbuild: {
    tsconfigRaw: {
      compilerOptions: {
        experimentalDecorators: true,
      },
    },
  } as any,
  resolve: {
    alias: {
      "@": path.resolve(__dirname),
    },
  },
  test: {
    environment: "node",
    include: ["test/integration/**/*.test.ts"],
    setupFiles: ["./test/integration/vitest.setup.ts"],
    globalSetup: ["./test/integration/global-setup.ts"],
    hookTimeout: 30000,
    testTimeout: 15000,
    fileParallelism: false,
  },
});
