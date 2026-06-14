// jest.config.ts
import type { Config } from 'jest';

const common = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  moduleNameMapper: {
    '^@common/(.*)$':         '<rootDir>/src/common/$1',
    '^@config/(.*)$':         '<rootDir>/src/config/$1',
    '^@events/(.*)$':         '<rootDir>/src/events/$1',
    '^@prisma-module/(.*)$':  '<rootDir>/src/prisma/$1',
    '^@redis/(.*)$':          '<rootDir>/src/redis/$1',
    '^@modules/(.*)$':        '<rootDir>/src/modules/$1',
  },
  transform: {
    '^.+\\.(t|j)s$': ['ts-jest', { tsconfig: 'tsconfig.json' }] as [string, { tsconfig: string }],
  },
};

const config: Config = {
  // DB-backed suites (schema/contract/integration/realtime) share a single
  // Postgres and clean it between tests, so they must not run concurrently.
  // Run serially for deterministic results; unit tests are stateless either way.
  maxWorkers: 1,
  projects: [
    // ── unit: co-located *.spec.ts inside src/ ───────────────────
    {
      ...common,
      displayName: 'unit',
      rootDir: '.',
      testMatch: ['<rootDir>/src/**/*.spec.ts'],
      coverageDirectory: 'coverage',
      collectCoverageFrom: [
        'src/**/*.ts',
        '!src/**/*.spec.ts',
        '!src/**/*.module.ts',
        '!src/main.ts',
      ],
    },
    // ── integration: *.integration.spec.ts inside src/ ──────────
    {
      ...common,
      displayName: 'integration',
      rootDir: '.',
      testMatch: ['<rootDir>/src/**/*.integration.spec.ts'],
    },
    // ── schema: test/schema-*.spec.ts ────────────────────────────
    {
      ...common,
      displayName: 'schema',
      rootDir: '.',
      testMatch: ['<rootDir>/test/schema-*.spec.ts'],
    },
    // ── contract: test/contract-*.spec.ts ───────────────────────
    {
      ...common,
      displayName: 'contract',
      rootDir: '.',
      testMatch: ['<rootDir>/test/contract-*.spec.ts'],
    },
    // ── realtime: test/realtime-*.spec.ts ───────────────────────
    {
      ...common,
      displayName: 'realtime',
      rootDir: '.',
      testMatch: ['<rootDir>/test/realtime-*.spec.ts'],
    },
  ],
  // Coverage threshold — G2 gate fails below 70 % (NF-19)
  coverageThreshold: {
    global: {
      lines:      70,
      branches:   70,
      functions:  70,
      statements: 70,
    },
  },
};

export default config;