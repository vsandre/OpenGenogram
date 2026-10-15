import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import tseslint from "typescript-eslint";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,

  {
    files: ["**/*.{ts,tsx}"],
    extends: [
      tseslint.configs.recommended,
      tseslint.configs.recommendedTypeChecked,
    ],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-misused-promises": "warn",
      "@typescript-eslint/await-thenable": "warn",

      // Native <img> is intentional for this static-export project.
      "@next/next/no-img-element": "off",

      "@typescript-eslint/no-floating-promises": "off", 
      "@typescript-eslint/no-unnecessary-type-assertion": "off",
    },
  },

  {
    files: ["scripts/**/*.{js,mjs}", "tests/**/*.{js,mjs}"],
    rules: {
      "no-console": "off",
    },
  },

  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "dist/**",
    "node_modules/**",
    ".open-next/**",
    ".wrangler/**",
    "next-env.d.ts",
    "*.config.mjs",
    "*.config.js",
    "cloudflare-env.d.ts",
    "worker-configuration.d.ts",
  ]),
]);

export default eslintConfig;
