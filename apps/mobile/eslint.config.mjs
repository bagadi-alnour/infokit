import tseslint from "typescript-eslint";

export default tseslint.config(
  // .expo holds Metro/expo-router generated files, including the typed-route
  // declarations: lint the app, not its build output.
  { ignores: [".cache", ".expo"] },
  {
    files: ["**/*.ts", "**/*.tsx"],
    extends: [
      ...tseslint.configs.strictTypeChecked,
      ...tseslint.configs.stylisticTypeChecked,
    ],
    rules: {
      // Same leading-underscore convention as the web app (apps/web/eslint.config.js):
      // a prop that exists only to be kept off a spread is named, not used.
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
    },
    languageOptions: {
      parserOptions: {
        projectService: true,
      },
    },
  },
);
