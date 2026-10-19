// astro.config.mjs
// @ts-check
import { defineConfig } from "astro/config";

import tailwindcss from "@tailwindcss/vite";
import path from "path";

import sitemap from "@astrojs/sitemap";
import node from "@astrojs/node";

// https://astro.build/config
export default defineConfig({
  site: "https://une-enlinea.com",
  adapter: node({ mode: "standalone" }),
  vite: {
    plugins: [tailwindcss()],
    resolve: {
      alias: {
        "@": path.resolve("./src"),
        "@assets": path.resolve("./src/assets"),
        "@components": path.resolve("./src/components"),
        "@layouts": path.resolve("./src/layouts"),
        "@utils": path.resolve("./src/utils"),
        "@pages": path.resolve("./src/pages"),
        "@helpers": path.resolve("./src/helpers"),
        "@layout": path.resolve("./src/components/layout"),
        "@logos": path.resolve("./src/assets/Logos"),
      },
    },
  },

  integrations: [sitemap()],
});
