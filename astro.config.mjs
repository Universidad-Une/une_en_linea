// astro.config.mjs
// @ts-check
import { defineConfig } from "astro/config";

import tailwindcss from "@tailwindcss/vite";
import path from "path";

import sitemap from "@astrojs/sitemap";

// https://astro.build/config
export default defineConfig({
  site: "https://une-enlinea.com",
  output: "static",
  vite: {
    server: {
      proxy: {
        "/api/forms/inscripcion": `http://127.0.0.1:${process.env.API_PORT || 4322}`,
      },
    },
    plugins: [tailwindcss()],
    resolve: {
      alias: {
        "@": path.resolve("./src"),
        "@assets": path.resolve("./src/assets"),
        "@components": path.resolve("./src/components"),
        "@layouts": path.resolve("./src/layouts"),
        "@pages": path.resolve("./src/pages"),
        "@helpers": path.resolve("./src/helpers"),
        "@layout": path.resolve("./src/components/layout"),
        "@logos": path.resolve("./src/assets/Logos"),
      },
    },
  },

  integrations: [sitemap()],
});
