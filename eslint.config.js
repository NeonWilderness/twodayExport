const eslintPluginPrettier = require('eslint-plugin-prettier');
const babelParser = require('@babel/eslint-parser');

module.exports = [
  {
    ignores: ['dist/**', 'layouts/**', 'node_modules/**'],
    languageOptions: {
      parser: babelParser,
      ecmaVersion: 'latest',
    },
    plugins: {
      prettier: eslintPluginPrettier,
    },
    rules: {
      'allowSingleLineBlocks': 'off',
      'brace-style': 'off',
      'curly': 'off',
      'one-var': 'off',
      'padded-blocks': 'off',
      'prefer-const': 'off',
      'prefer-promise-reject-errors': 'off',
      'no-extra-boolean-cast': 'off',
      'no-extra-parens': 'off',
      'no-prototype-builtins': 'off',
      'no-trailing-spaces': 'off',
      'no-undef': 'off',
      'semi': 'off',
      'space-before-function-paren': 'off'
    }
  }
];
