import js from '@eslint/js'
import globals from 'globals'
export default [
  { ignores: ['node_modules/**', '.next/**', '.next-production/**', '.pnpm-store/**', '.verification/**', '**/*.ts', '**/*.tsx'] },
  js.configs.recommended,
  { files: ['**/*.{js,jsx,cjs,mjs}'], languageOptions: {
    globals: { ...globals.browser, ...globals.node },
    parserOptions: { ecmaFeatures: { jsx: true } },
  }, rules: { 'no-unused-vars': 'off' } },
]
