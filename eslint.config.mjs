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
    // The Telegram-backed Prisma shim returns loosely typed rows (see src/lib/prisma.ts).
    rules: { "@typescript-eslint/no-explicit-any": "warn" },
  },
];

export default eslintConfig;
