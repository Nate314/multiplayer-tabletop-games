import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'

const reactRules = {
  ...reactHooks.configs.recommended.rules,
  'react-refresh/only-export-components': [
    'warn',
    { allowConstantExport: true },
  ],
}

const plugins = {
  'react-hooks': reactHooks,
  'react-refresh': reactRefresh,
}

export default tseslint.config(
  { ignores: ['dist'] },
  {
    files: ['**/*.js'],
    extends: [js.configs.recommended],
    languageOptions: {
      ecmaVersion: 'latest',
      globals: globals.node,
      sourceType: 'module',
    },
  },
  {
    files: ['public/sw.js'],
    languageOptions: { globals: globals.serviceworker, sourceType: 'script' },
  },
  {
    files: ['**/*.{ts,tsx}'],
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    languageOptions: {
      ecmaVersion: 'latest',
      globals: globals.browser,
    },
    plugins,
    rules: {
      ...reactRules,
      '@typescript-eslint/no-unused-vars': ['error', { varsIgnorePattern: '^[A-Z_]' }],
    },
  },
  {
    // Playwright fixtures take an empty `{}` and hand their value on through a `use` that is not React's
    files: ['e2e/**/*.ts'],
    rules: {
      'no-empty-pattern': 'off',
      'react-hooks/rules-of-hooks': 'off',
    },
  },
)
