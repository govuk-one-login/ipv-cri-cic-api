import ts from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';

export default [
  {
    ignores: [
      "node_modules",
      ".aws-sam",
      "dist",
      "reports/",
      "/tests/infra/**",
      "build"
  ]
},{
    files: ['**/*.ts'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        project: './tsconfig.json',
      },
    },
    plugins: {
      '@typescript-eslint': ts,
    },
    rules: {
      ...ts.configs.recommended.rules,
    },
  },
  {
    languageOptions: {
      globals: {
        process: true,
        __dirname: true,
        __filename: true,
        require: true,
        module: true,
        exports: true,
      },
    },
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      'no-console': 'off', // Allow console logs in backend
      'no-process-exit': 'off', // Allow process.exit()
    },
  },
];