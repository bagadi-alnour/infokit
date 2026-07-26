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
    languageOptions: {
      parserOptions: {
        projectService: true,
      },
    },
  },
);
