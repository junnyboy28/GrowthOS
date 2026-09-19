import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const ADAPTER_IMPORT_MESSAGE =
  "Import lib/adapters/mock or lib/adapters/real only from lib/adapters itself or lib/loop/execute.ts " +
  "(the only path to adapters). Use lib/adapters' getAdsPlatform()/getSearchProvider(), or " +
  "lib/loop/execute.ts, everywhere else.";

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_" },
      ],
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: [
                "@/lib/adapters/mock/*",
                "@/lib/adapters/real/*",
                "**/adapters/mock/*",
                "**/adapters/real/*",
              ],
              message: ADAPTER_IMPORT_MESSAGE,
            },
          ],
        },
      ],
    },
  },
  {
    ignores: [".next/**", "node_modules/**", "next-env.d.ts", "coverage/**"],
  },
  {
    // The adapter implementations themselves, and the one sanctioned caller.
    files: ["lib/adapters/**", "lib/loop/execute.ts"],
    rules: {
      "no-restricted-imports": "off",
    },
  },
  {
    // Setup/infra tooling, not a stage or route handler — only needs the id generator. Scoped
    // narrowly to that one named import so a future stray MockMetaAds (or new adapter export)
    // import here still gets caught, instead of blanket-exempting the whole file.
    files: ["lib/mock/seed.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "@/lib/adapters/mock/ads",
              importNames: ["MockMetaAds"],
              message: "seed.ts may only import generateExternalId from lib/adapters/mock/ads.",
            },
          ],
        },
      ],
    },
  },
];

export default eslintConfig;
