import eslint from "@eslint/js"
import { defineConfig } from "eslint/config"
import importPlugin from "eslint-plugin-import"
import pluginUnicorn from "eslint-plugin-unicorn"
import globals from "globals"
import tseslint from "typescript-eslint"

/** @type {import('eslint').Linter.Config[]} */
export default defineConfig(
  {
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
  },
  eslint.configs.recommended,
  tseslint.configs.recommended,
  pluginUnicorn.configs.recommended,
  importPlugin.flatConfigs.typescript,
  {
    rules: {
      "no-undef": "error",
      "react/react-in-jsx-scope": "off",
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
      "import/order": [
        "error",
        {
          "newlines-between": "always",
          "alphabetize": {
            order: "asc",
            caseInsensitive: true,
          },
        },
      ],
      "unicorn/prefer-module": "off", // allow __dirname etc
      "unicorn/prevent-abbreviations": "off", // this isn't java
      "unicorn/filename-case": "off", // lowercase class files are weird
      "unicorn/consistent-function-scoping": "off", // breaks command builders
      "unicorn/prefer-ternary": ["error", "only-single-line"],
      "unicorn/no-null": "off", // wtf...
      "unicorn/no-array-reduce": "off", // skill issue
      "unicorn/no-array-callback-reference": "off", // typescript will handle it
      "unicorn/no-await-expression-member": "off", // less readable and breaks type infers
      "unicorn/no-nested-ternary": "off", // prettier format conflict
    },
  },
)
