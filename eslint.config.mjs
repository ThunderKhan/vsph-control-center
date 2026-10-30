import js from '@eslint/js';
import globals from 'globals';
export default [
  { ignores: ['node_modules/**', 'playwright-report/**', 'test-results/**', 'coverage/**'] },
  { files: ['**/*.{js,mjs}'], languageOptions: { globals: { ...globals.node, ...globals.browser }, sourceType: 'commonjs' }, rules: {
    'no-debugger': 'error', 'no-unreachable': 'error', 'no-constant-binary-expression': 'error',
  } },
  { files: ['**/*.mjs'], languageOptions: { sourceType: 'module' } },
];
