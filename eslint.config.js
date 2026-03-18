
const { FlatCompat } = require("@eslint/eslintrc");
const js = require("@eslint/js");
const path = require("path");

const compat = new FlatCompat({
    baseDirectory: typeof __dirname !== 'undefined' ? __dirname : path.resolve('.'),
    recommendedConfig: js.configs.recommended,
});

module.exports = [
    ...compat.extends("expo"),
    {
        files: ["**/*.ts", "**/*.tsx"],
        languageOptions: {
            parserOptions: {
                project: "./tsconfig.json",
            },
        },
        rules: {
            // Add custom rules here if needed
            "no-unused-vars": "warn",
            "react-hooks/exhaustive-deps": "warn"
        },
    },
];
