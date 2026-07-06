import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // ponytail: vendor API payloads are still loosely typed; keep CI useful while typing them incrementally.
      "@typescript-eslint/no-explicit-any": "warn",
      // _-prefix = intentionally unused (destructure to omit, callback params, etc.)
      "@typescript-eslint/no-unused-vars": ["warn", { varsIgnorePattern: "^_", argsIgnorePattern: "^_" }],
      // Next.js 16's core-web-vitals flags setState in useEffect as error; this is too strict for standard data fetching.
      "react-hooks/set-state-in-effect": "warn",
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "public/marketing-vision-script.js", // legacy vendor script
  ]),
]);

export default eslintConfig;
