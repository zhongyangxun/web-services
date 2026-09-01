import js from '@eslint/js'
import prettier from 'eslint-config-prettier'
import simpleImportSort from 'eslint-plugin-simple-import-sort'
import tseslint from 'typescript-eslint'

export default [
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    ignores: ['**/dist/**', '**/node_modules/**', '**/.wrangler/**'],
  },
  {
    files: ['**/*.ts'],
    plugins: {
      'simple-import-sort': simpleImportSort,
    },
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_' },
      ],
      'simple-import-sort/imports': [
        'error',
        {
          groups: [
            ['^\\u0000'], // side-effect
            ['^node:', '^cloudflare:', '^crypto$'], // 运行时 / 内置模块
            ['^(?!@web-services)@?\\w'], // 第三方
            ['^@web-services/'], // 工作区
            ['^\\.'], // 相对路径
          ],
        },
      ],
      'simple-import-sort/exports': 'error',
    },
  },

  // 关闭与 prettier 冲突的规则
  prettier,
]
