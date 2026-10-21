import frontend from "@devbie/style-guide/eslint/frontend";

export default [
  ...frontend,
  {
    ignores: ["**/dist/**", "**/coverage/**"],
  },
];
