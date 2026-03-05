module.exports = {
  root: true,
  env: { node: true, es2022: true },
  extends: ['eslint:recommended'],
  parserOptions: { ecmaVersion: 2022, sourceType: 'module' },
  overrides: [
    {
      files: ['**/*.ts', '**/*.tsx'],
      parser: '@typescript-eslint/parser',
      extends: ['eslint:recommended', 'prettier'],
      plugins: ['@typescript-eslint'],
      parserOptions: { project: true },
      rules: { '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }] },
    },
  ],
  ignorePatterns: ['node_modules', 'dist', 'cdk.out', '*.cjs'],
};
