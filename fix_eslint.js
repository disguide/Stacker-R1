const fs = require('fs');

let code = fs.readFileSync('eslint.config.js', 'utf8');

// The file is CommonJS, why is __dirname not defined?
// Ah, ESLint Flat Config in a pure ESM project (if package.json has "type": "module") might break.
// Wait, package.json doesn't have "type": "module".
// ESLint flat config loads files as ESM by default if it detects something or is named .js on new node versions sometimes.
// But we can fix it by explicitly defining __dirname if it's not defined.

code = `
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
`;

fs.writeFileSync('eslint.config.js', code);
