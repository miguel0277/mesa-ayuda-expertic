import path from "node:path";
import { defineConfig } from "vitest/config";

// Node 20 no trae Map.groupBy (Node 21+) y el reportero de Vitest 5 lo usa al imprimir errores.
if (!("groupBy" in Map)) {
  Object.defineProperty(Map, "groupBy", {
    value<T, K>(items: Iterable<T>, key: (item: T, index: number) => K) {
      const out = new Map<K, T[]>();
      let i = 0;
      for (const item of items) {
        const k = key(item, i++);
        const list = out.get(k);
        if (list) list.push(item);
        else out.set(k, [item]);
      }
      return out;
    },
  });
}

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
      // `server-only` lanza error fuera de React Server Components; en pruebas es un no-op.
      "server-only": path.resolve(import.meta.dirname, "tests/helpers/server-only-stub.ts"),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "tests/**/*.test.ts"],
    exclude: ["tests/e2e/**", "node_modules/**"],
    testTimeout: 60_000,
    hookTimeout: 120_000,
  },
});
