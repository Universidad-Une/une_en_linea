import type { APIRoute } from "astro";
import { SITE_NOINDEX } from "astro:env/server";

// Con SITE_NOINDEX=true (preview) se bloquea a todos los rastreadores, buscadores e IA.
const bloqueado = `# Sitio de pruebas: no indexar ni usar para entrenar modelos.
User-agent: *
Disallow: /
`;

const produccion = `# Permitir que todos los buscadores e IA rastreen el sitio
User-agent: *
Allow: /

# Bloquear archivos y directorios que no deberían indexarse
Disallow: /api/
Disallow: /_astro/
Disallow: /admin/
Disallow: /*.json$

# Tiempo de espera entre solicitudes (en segundos)
Crawl-delay: 1

# Sitemap generado automáticamente por la integración de Astro
Sitemap: https://une-enlinea.com/sitemap-index.xml`;

export const GET: APIRoute = () =>
  new Response(SITE_NOINDEX ? bloqueado : produccion, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
