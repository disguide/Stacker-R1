
import { FlatCompat } from "@eslint/eslintrc";
import js from "@eslint/js";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const compat = new FlatCompat({
    baseDirectory: __dirname,
    recommendedConfig: js.configs.recommended,
});

export default [
    ...compat.extends("expo"),
    {
        ignores: [
            "updated_profile_fix.js",
            "benchmark.ts",
            "dist/**",
            "android/**",
            "*.txt",
        ],
    },
    {
        files: ["**/*.ts", "**/*.tsx"],
        languageOptions: {
            parserOptions: {
                project: "./tsconfig.json",
            },
        },
        rules: {
            // TypeScript handles module resolution (0 tsc errors) — these are redundant
            "import/no-unresolved": "off",
            "import/namespace": "off",
            // Project rules
            "no-unused-vars": "warn",
            "react-hooks/exhaustive-deps": "warn",
            "react-hooks/rules-of-hooks": "warn",
            "react-hooks/set-state-in-effect": "off",
            "react-hooks/refs": "off"
        },
    },
];
