import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    ignores: [
      "node_modules/**",
      ".next/**",
      "out/**",
      "build/**",
      "next-env.d.ts",
    ],
  },
  {
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
    },
  },
  {
    files: ["components/ui/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "next-intl",
              message: "components/ui 禁止依赖 i18n，文案由 props 注入。",
            },
          ],
          patterns: [
            {
              group: ["@/features", "@/features/*"],
              message: "components/ui 禁止依赖业务 feature。",
            },
            {
              group: ["@/store", "@/store/*"],
              message: "components/ui 禁止依赖桌面/应用 store（modal/toast 自有 store 除外）。",
            },
            {
              group: ["@/components/desktop", "@/components/desktop/*"],
              message: "components/ui 禁止依赖桌面壳。",
            },
            {
              group: ["@/hooks", "@/hooks/*"],
              message: "components/ui 禁止依赖项目 hooks，断点由 props 注入。",
            },
            {
              group: ["@/lib/desktop", "@/lib/desktop/*", "@/lib/vfs", "@/lib/vfs/*", "@/lib/wallpaper", "@/lib/wallpaper/*"],
              message: "components/ui 禁止依赖桌面内核 / VFS / 壁纸引擎。",
            },
          ],
        },
      ],
    },
  },
];

export default eslintConfig;
