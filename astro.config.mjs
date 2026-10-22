// astro.config.mjs
// @ts-check
import { defineConfig, envField } from "astro/config";
import { loadEnv } from "vite";

import tailwindcss from "@tailwindcss/vite";
import path from "path";

import sitemap from "@astrojs/sitemap";

// SITE_NOINDEX=true (p. ej. en el servidor de preview) pide a buscadores e IA no indexar
// el sitio: meta robots en el Layout, robots.txt con Disallow y sin sitemap.
const { SITE_NOINDEX } = loadEnv(process.env.NODE_ENV ?? "production", process.cwd(), "");
const noIndexar = SITE_NOINDEX === "true";

// https://astro.build/config
export default defineConfig({
  site: "https://une-enlinea.com",
  output: "static",
  env: {
    schema: {
      SITE_NOINDEX: envField.boolean({ context: "server", access: "public", default: false }),
    },
  },
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
        // Solo para código que también corre en el navegador (p. ej. server/validacion.mjs).
        "@server": path.resolve("./server"),
        "@layout": path.resolve("./src/components/layout"),
        "@logos": path.resolve("./src/assets/Logos"),
      },
    },
  },

  integrations: noIndexar ? [] : [sitemap()],
});
