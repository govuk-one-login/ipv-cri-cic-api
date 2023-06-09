/*
 * For a detailed explanation regarding each configuration property and type check, visit:
 * https://jestjs.io/docs/configuration
 */

const dotenv = require('dotenv');
dotenv.config({ path: `./.${process.env.ENV}.env` });
console.log("Env: " + `./.${process.env.ENV}.env`)

export default {
  transform: {
    '^.+\\.ts?$': 'ts-jest'
  },
  testTimeout: 10000,
  clearMocks: true,
  collectCoverage: true,
  collectCoverageFrom: [
    './**/*.ts',
    '!./**/tests/**/*.ts',
    '!./tests/**/*.ts',
    '!./jest.config.ts'
  ],
  coverageDirectory: 'coverage',
  coverageProvider: 'v8',
  coveragePathIgnorePatterns: ['config.ts', 'node_modules/'],
  testMatch: ['**/tests/**/*.test.ts'],
  setupFiles: [
    './jest.setup.ts'
  ],
  testEnvironment: 'node',
  reporters: [
    'default',
    ['jest-junit', { outputDirectory: 'results', outputName: 'report.xml' }]
  ]
}
