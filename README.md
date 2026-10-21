# 🎓 Universidad UNE En Línea

Sitio web de **Universidad UNE En Línea**: un sitio estático en [Astro 5](https://astro.build/)
con Tailwind CSS v4, más un pequeño backend en Node que recibe las solicitudes de
inscripción y las envía a Google Forms.

## Estructura

```text
/
├── src/            # Sitio Astro → se compila a dist/ (estático)
│   ├── components/ #   layout/, sections/, inscripcion/ (formulario)
│   ├── pages/      #   rutas del sitio
│   ├── layouts/  assets/  helpers/  styles/
├── public/         # archivos que se copian tal cual
├── server/         # Backend Node (corre en el VPS con PM2)
│   ├── api.mjs     #   POST /api/forms/inscripcion → guarda en SQLite
│   ├── worker.mjs  #   envía a Google y reintenta
│   ├── validacion, cola, entrega, db…  test/
│   └── apps-script/#   receptor que corre en Google (se copia a mano)
├── deploy/         # PM2 y fragmento de nginx
├── docs/           # documentación
├── deploy.sh  rollback.sh
└── .env.example    # todas las variables, comentadas
```

Alias de importación (en `tsconfig.json`): `@/` → `src/`, `@components`, `@layout`,
`@layouts`, `@pages`, `@assets`, `@logos`, `@icons`, `@helpers`.

## Desarrollo local

```bash
npm install
cp .env.example .env      # completar URL y secreto de Apps Script
npm run db:init           # crea data/inscripciones.sqlite
```

Para el sitio solo: `npm run dev` (http://localhost:4321).

Para probar el formulario de inscripción completo, en tres terminales:

```bash
npm run dev
npm run api               # 127.0.0.1:4322; Astro le reenvía /api/forms/inscripcion
npm run worker            # envía a la URL real de .env: usar un formulario de prueba
```

Sin worker las solicitudes se guardan pero no llegan a Google.
`npm run worker -- --once` procesa como máximo un trabajo y sale.
`npm run preview` sirve el build sin el proxy, así que ahí el formulario no funciona.

## Comandos

| Comando | Acción |
| :-- | :-- |
| `npm run dev` | Sitio en desarrollo con recarga en caliente |
| `npm run build` | Compila el sitio a `dist/` |
| `npm run api` / `npm start` | API de inscripción |
| `npm run worker` | Envíos y reintentos a Google |
| `npm run db:init` | Crea la base SQLite |
| `npm run db:query -- "SELECT ..."` | Consulta de solo lectura; sin SQL muestra las últimas 20 |
| `npm test` | Todas las pruebas del backend (sin Google real ni `.env`) |

## Documentación

- [Backend (`server/`)](server/README.md): archivos y reglas al modificarlo.
- [Inscripción](docs/inscripcion.md): cómo funciona el flujo, estados y qué hacer cuando falla.
- [Despliegue](docs/despliegue.md): VPS, PM2, nginx, actualizar y revertir.
- [Receptor de Apps Script](server/apps-script/README.md): configurarlo en Google.
- [Reporte de redirecciones](docs/reportes/redirects.md).

## Convenciones

- **Imágenes:** usar `<Image />` de Astro siempre que sea posible.
- **Estilos:** preferir clases de Tailwind sobre CSS propio.
- **Componentes:** pequeños y con una sola responsabilidad.
