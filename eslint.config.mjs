import tseslint from "typescript-eslint";

export default tseslint.config(
  { files: ["src/**/*.ts"], extends: [...tseslint.configs.recommended] },
  {
    // SYSTEM-OVERVIEW §3.2: the domain layer is pure TypeScript.
    files: ["src/domain/**/*.ts"],
    ignores: ["src/domain/__tests__/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            { group: ["react", "react-native", "expo", "expo-*", "../data/*", "../features/*", "../components/*", "../lib/*", "../../app/*"],
              message: "src/domain may only import from src/domain." },
          ],
        },
      ],
    },
  },
  {
    // SYSTEM-OVERVIEW §3.3: size signals (warnings, reviewed by hand).
    files: ["src/**/*.ts"],
    ignores: ["**/__tests__/**"],
    rules: {
      "max-lines-per-function": ["warn", { max: 40, skipBlankLines: true, skipComments: true }],
      complexity: ["warn", 10],
      "max-lines": ["warn", { max: 400, skipBlankLines: true, skipComments: true }],
    },
  },
);
