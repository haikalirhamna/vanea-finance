import tseslint from 'typescript-eslint';

const SOURCE = ['src/**/*.{ts,tsx}', 'app/**/*.{ts,tsx}'];
const TESTS = ['**/__tests__/**', '**/*.test.{ts,tsx}'];

const UI_AND_RUNTIME = ['react', 'react-native', 'react-native-*', 'expo', 'expo-*', '@expo/*'];
const UPPER_LAYERS = ['@/data/*', '@/features/*', '@/components/*', '@/lib/*', '../data/*', '../features/*', '../components/*', '../lib/*', '../../app/*'];

export default tseslint.config(
  { ignores: ['node_modules', '.expo', 'dist', 'coverage'] },
  { files: SOURCE, extends: [...tseslint.configs.recommended] },
  {
    // SYSTEM-OVERVIEW §3.2: src/domain is pure TypeScript and imports nothing outside src/domain.
    files: ['src/domain/**/*.ts'],
    ignores: TESTS,
    rules: {
      'no-restricted-imports': ['error', {
        patterns: [{ group: [...UI_AND_RUNTIME, ...UPPER_LAYERS], message: 'src/domain may only import from src/domain.' }],
      }],
    },
  },
  {
    // The data layer talks to storage only: no UI, no feature code.
    files: ['src/data/**/*.ts'],
    ignores: TESTS,
    rules: {
      'no-restricted-imports': ['error', {
        patterns: [{
          group: ['react', 'react-native', 'react-native-*', '@/features/*', '@/components/*', '@/lib/*', '../features/*', '../components/*', '../lib/*'],
          message: 'src/data may import src/domain, storage libraries and itself only.',
        }],
      }],
    },
  },
  {
    // SYSTEM-OVERVIEW §3.3: size signals (warnings, reviewed by hand).
    files: SOURCE,
    ignores: TESTS,
    rules: {
      'max-lines-per-function': ['warn', { max: 40, skipBlankLines: true, skipComments: true }],
      complexity: ['warn', 10],
      'max-lines': ['warn', { max: 400, skipBlankLines: true, skipComments: true }],
    },
  },
  {
    // Declarative JSX is longer than logic; components may be 60 lines before they should be split.
    files: ['src/**/*.tsx', 'app/**/*.tsx'],
    ignores: TESTS,
    rules: { 'max-lines-per-function': ['warn', { max: 60, skipBlankLines: true, skipComments: true }] },
  },
);
