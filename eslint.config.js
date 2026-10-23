import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';
import { defineConfig, globalIgnores } from 'eslint/config';

export default defineConfig([
  globalIgnores(['dist', 'src-tauri']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    rules: {
      // Cho phép `const { field, ...rest } = record` để bỏ một trường khỏi bản ghi.
      '@typescript-eslint/no-unused-vars': ['error', { ignoreRestSiblings: true }],
    },
  },
  {
    // SPEC mục 1.3: core/ là logic thuần, không phụ thuộc Tauri, React hay tầng lưu trữ.
    files: ['src/core/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: [
                '@tauri-apps/*',
                'react',
                'react-dom',
                'zustand',
                'zustand/*',
                'recharts',
                '../storage/*',
                '../sync/*',
                '../state/*',
                '../features/*',
                '../components/*',
              ],
              message: 'src/core chỉ chứa hàm thuần, không import Tauri, React hay tầng ngoài.',
            },
          ],
        },
      ],
    },
  },
  prettier,
]);
