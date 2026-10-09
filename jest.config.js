/** Domain tests run in plain Node: src/domain has no React or Expo dependency. */
module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  roots: ["<rootDir>/src"],
  testMatch: ["**/*.test.ts"],
  collectCoverageFrom: ["src/domain/**/*.ts", "!src/domain/__tests__/**"],
};
