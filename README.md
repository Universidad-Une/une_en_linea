# 🎓 Universidad UNE En Línea

Este repositorio contiene el código fuente del sitio web de **Universidad UNE En Línea**, una aplicación web moderna y de alto rendimiento construida con [Astro](https://astro.build/).

## 🚀 Tecnologías Principales

El proyecto utiliza un stack tecnológico moderno enfocado en el rendimiento y la experiencia de usuario:

- **[Astro 5](https://astro.build/)**: Framework web para sitios orientados a contenido, optimizado para velocidad.
- **[Tailwind CSS v4](https://tailwindcss.com/)**: Framework de utilidades para un diseño rápido y responsivo.
- **[Splide.js](https://splidejs.com/)**: Carruseles y sliders ligeros y accesibles.
- **[Lucide Icons](https://lucide.dev/)**: Iconos vectoriales limpios y consistentes.
- **[tsParticles](https://particles.js.org/)**: Animaciones de partículas ligeras para fondos interactivos.

## 📂 Estructura del Proyecto

El proyecto sigue una estructura modular y organizada:

```text
/
├── public/             # Archivos estáticos (imágenes, favicon, robots.txt)
├── src/
│   ├── components/     # Componentes reutilizables de la UI
│   │   ├── layout/     # Componentes estructurales (Header, Footer)
│   │   └── sections/   # Secciones de página (Hero, Features, etc.)
│   ├── pages/          # Rutas de la aplicación (basado en archivos)
│   │   ├── acerca/     # Páginas informativas
│   │   ├── oferta-academica/ # Catálogo de programas educativos
│   │   └── index.astro # Página de inicio
│   └── assets/         # Recursos como imágenes, fuentes e iconos
└── package.json
```

### 📍 Alias de Importación

Para facilitar el desarrollo y mantener el código limpio, se han configurado los siguientes alias:

- `@/`: `src/`
- `@components`: `src/components`
- `@layout`: `src/components/layout`
- `@sections`: `src/components/sections`
- `@assets`: `src/assets`
- `@images`: `src/assets/images`
- `@logos`: `src/assets/Logos`

## 🛠️ Comandos Disponibles

Todos los comandos se ejecutan desde la raíz del proyecto. Se recomienda usar `npm` o `pnpm`.

| Comando             | Acción                                                                                         |
| :------------------ | :--------------------------------------------------------------------------------------------- |
| `npm run dev`       | Inicia el servidor de desarrollo local en `localhost:4321`. Incluye recarga en caliente (HMR). |
| `npm run build`     | Compila el sitio para producción en el directorio `./dist/`.                                   |
| `npm run api` | Inicia la API independiente en 127.0.0.1:4322. |
| `npm start` | Alias de la API; no sirve el sitio estático. |
| `npm run db:init` | Crea SQLite local o migra su esquema versionado con respaldo previo para versión 1. |
| `npm run db:query` | Consulta las últimas 20 inscripciones en modo de solo lectura; acepta SQL después de `--`. |
| `npm run worker` | Procesa el primer envío y los reintentos en segundo plano; requiere otra terminal. |
| `npm run worker -- --once` | Procesa como máximo un trabajo disponible y sale. |
| `npm run test:database` | Prueba persistencia e historial con una base temporal. |
| `npm run test:worker` | Prueba reintentos, reservas y recuperación sin Google real. |
| `npm run test:rate-limit` | Prueba límites de peticiones e identificación de IP. |
| `npm run test:inscripcion-integration` | Prueba API independiente, worker y dist estático con receptor simulado. |
| `npm run preview`   | Previsualiza la versión compilada localmente antes de desplegar.                               |
| `npm run astro ...` | Ejecuta comandos CLI como `astro add`, `astro check`.                                          |

## 🏁 Comenzando

1.  **Clonar el repositorio:**

    ```bash
    git clone <url-del-repo>
    cd une-enlinea
    ```

2.  **Instalar dependencias:**

    ```bash
    npm install
    # o
    pnpm install
    ```

3. **Configurar el entorno y crear SQLite:** copia `.env.example` a `.env`,
   configura la URL y el secreto de Apps Script y conserva la ruta local de SQLite.
   Para una base nueva ejecuta:

    ```bash
    npm run db:init
    ```

4.  **Iniciar servidor de desarrollo:**
    ```bash
    npm run dev
    ```

5. **Iniciar la API:** en otra terminal ejecuta `npm run api`. El proxy de desarrollo conecta el formulario con el puerto `API_PORT` (4322 por defecto).

6. **Activar envíos y reintentos:** en otra terminal ejecuta `npm run worker`.
   La pregunta técnica y la implementación de Apps Script deben estar configuradas
   según [el receptor](apps-script/README.md).
   La API confirma al guardar en SQLite; sin worker las solicitudes quedan pendientes.

## Notas de Desarrollo

Astro genera un único `dist/` estático. PM2 administra la API y el worker con
`ecosystem.config.cjs`; Nginx sirve `dist` y reenvía la ruta de inscripción.
La configuración vigente está en [Despliegue PM2](deployment/pm2.md).

La configuración de SQLite local y el historial de intentos están documentados
en [SQLite local](documentación/sqlite-local.md).
Los reintentos y sus comandos se describen en [Worker local](documentación/worker-inscripcion.md).
La protección de la API se configura en [Límite de peticiones](documentación/limite-peticiones-inscripcion.md).

- **Imágenes**: Usa el componente `<Image />` de Astro siempre que sea posible para la optimización automática.
- **Estilos**: Preferir clases de Tailwind CSS sobre CSS personalizado.
- **Componentes**: Mantener los componentes pequeños y enfocados en una sola responsabilidad.

---

Desarrollado con ❤️ para Universidad UNE.
