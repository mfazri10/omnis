import tseslint from "typescript-eslint";
import base from "@workspace/eslint-config/base.js";

export default tseslint.config(...base, {
  languageOptions: {
    parserOptions: {
      projectService: true,
      tsconfigRootDir: import.meta.dirname,
    },
  },
});
