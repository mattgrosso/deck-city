// ESLint 9 flat config. Matches the style used across the author's other
// Vue projects (see cinemaroll/eslint.config.js) for consistency.

import js from '@eslint/js'
import vue from 'eslint-plugin-vue'
import promise from 'eslint-plugin-promise'
import globals from 'globals'

export default [
  {
    ignores: ['dist/**', 'node_modules/**', 'coverage/**']
  },

  js.configs.recommended,
  ...vue.configs['flat/essential'],
  promise.configs['flat/recommended'],

  {
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        ...globals.browser,
        ...globals.node
      }
    },
    rules: {
      'vue/multi-word-component-names': 'off',
      'no-trailing-spaces': 'warn',
      quotes: ['off', 'single'],
      semi: 'off',
      'comma-dangle': 'off',
      'space-before-function-paren': 'warn',
      indent: ['warn', 2, { SwitchCase: 1 }],
      'no-undef': 'warn',
      'padded-blocks': ['warn', 'never'],
      'object-curly-spacing': ['warn', 'always'],
      'array-bracket-spacing': ['warn', 'never'],
      'no-unused-vars': 'warn',
      'no-empty': 'warn',
      'prefer-const': 'warn',
      'no-multiple-empty-lines': 'warn',
      'no-debugger': 'warn',
      'space-infix-ops': 'warn',
      'space-before-blocks': 'warn',
      'no-unreachable': 'warn',
      'no-constant-condition': 'warn',
      eqeqeq: ['warn', 'smart'],
      'no-var': 'warn',
      'brace-style': ['warn', '1tbs', { allowSingleLine: true }]
    }
  },

  {
    files: ['src/test/**/*.{js,vue}'],
    languageOptions: {
      globals: {
        describe: 'readonly',
        it: 'readonly',
        expect: 'readonly',
        vi: 'readonly',
        beforeEach: 'readonly',
        afterEach: 'readonly',
        beforeAll: 'readonly',
        afterAll: 'readonly',
        test: 'readonly'
      }
    }
  }
]
