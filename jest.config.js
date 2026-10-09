/**
 * Two projects:
 *  - logic: src/domain, src/data, src/features/**.test.ts — plain Node (ts-jest), no Expo needed.
 *  - app:   *.test.tsx — React Native components and screens (jest-expo).
 */
const alias = { '^@/(.*)$': '<rootDir>/src/$1' };

module.exports = {
  projects: [
    {
      displayName: 'logic',
      preset: 'ts-jest',
      testEnvironment: 'node',
      testMatch: ['<rootDir>/src/**/*.test.ts'],
      moduleNameMapper: alias,
      // @noble/* is ESM-only JavaScript: ts-jest compiles it to CommonJS too.
      transform: { '^.+\\.[tj]s$': ['ts-jest', { tsconfig: 'tsconfig.jest.json', diagnostics: false }] },
      transformIgnorePatterns: ['/node_modules/(?!@noble/)'],
    },
    {
      displayName: 'app',
      preset: 'jest-expo',
      testMatch: ['<rootDir>/src/**/*.test.tsx', '<rootDir>/app/**/*.test.tsx'],
      moduleNameMapper: alias,
      setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
    },
  ],
  collectCoverageFrom: ['src/domain/**/*.ts', 'src/data/**/*.ts', '!**/__tests__/**', '!**/*.d.ts'],
};
