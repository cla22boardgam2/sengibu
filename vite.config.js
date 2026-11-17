import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  base: "./",
  plugins: [react()],
  test: { environment: "jsdom", globals: true, dir: "tests", include: ["**/*.test.{js,jsx}"] },
});
