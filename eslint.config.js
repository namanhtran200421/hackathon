/**
 * Code checks, run with `npm run lint`.
 *
 * On top of the recommended JavaScript and TypeScript rules, two house rules
 * keep the code easy to read:
 *   - use if / else instead of the `? :` operator
 *   - use `function () {}` instead of arrow functions
 */

import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";

const houseRules = {
  "no-restricted-syntax": [
    "error",
    { selector: "ConditionalExpression", message: "Use if / else instead of the ? : operator." },
    { selector: "ArrowFunctionExpression", message: "Use function () {} instead of an arrow function." },
  ],
  "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
};

export default tseslint.config(
  {
    ignores: [
      "**/node_modules/**",
      ".next/**",
      "**/dist/**",
      "test-results/**",
      "playwright-report/**",
      // Generated or third-party files.
      "packages/simulation/runtime/**",
      "packages/simulation/build/vendor/**",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["**/*.{ts,tsx,js}"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: { ...globals.node },
    },
    rules: houseRules,
  },
  {
    files: ["apps/web/**/*.{ts,tsx}", "e2e/**/*.ts"],
    languageOptions: { globals: { ...globals.browser } },
  },
);
