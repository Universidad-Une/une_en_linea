# Límite de peticiones en Node

`api/server.mjs` ejecuta la protección de `src/lib/server/inscripcion-rate-limit.mjs`
antes del handler de inscripción. La API ya no depende del middleware de Astro.
Solo afecta a `POST /api/forms/inscripcion`, incluidas la barra final y las
codificaciones de ruta equivalentes aceptadas por Astro. No agrega endpoints,
no modifica el formulario anterior ni limita visitas a páginas del sitio.

## Configuración

En `.env` local o en el entorno de `une-api` de PM2:

```dotenv
INSCRIPCION_RATE_LIMIT_PER_IP=5
INSCRIPCION_RATE_LIMIT_GLOBAL=60
INSCRIPCION_RATE_LIMIT_WINDOW_MS=60000
INSCRIPCION_TRUST_PROXY=false
```

Los valores anteriores son los predeterminados. Cambiar los números y reiniciar
la API aplica la nueva política sin recompilar ni editar Nginx. El worker no
necesita reiniciarse por estos parámetros. Configuración inválida bloquea el
endpoint con 503, en lugar de dejarlo sin protección.

- Cada IP puede realizar cinco peticiones admitidas por el middleware en los
  últimos 60 segundos. Es ventana deslizante: el contador no se reinicia al
  cambiar el minuto del reloj.
- El cupo global admite hasta 60 peticiones en esa misma ventana por proceso,
  sumando todas las IP. Cuenta también solicitudes con JSON/datos inválidos.
- Un rechazo por exceso de una IP no consume el cupo global de otros usuarios.
- El exceso devuelve HTTP 429, JSON genérico, `Cache-Control: no-store` y
  `Retry-After` con segundos hasta que se libere cupo. No lee el cuerpo ni crea
  una inscripción, intento o tarea para el worker.
- La protección no espera ni consulta Google; usa contadores en memoria y no
  hace escrituras a SQLite por solicitudes bloqueadas.

El límite por IP puede afectar a personas que comparten una red, por ejemplo
una escuela. Ajustarlo con tráfico real; no representa cinco intentos por
persona. Las IP IPv6 se normalizan pero no se agrupan por subred: distintas
direcciones consumen cupos distintos y siguen sujetas al límite global.

## Identificación de IP y proxy

**Local o Node directo: `INSCRIPCION_TRUST_PROXY=false`.** Usa la IP del socket
(`req.socket.remoteAddress`). Ignora tanto `X-Forwarded-For` como `X-Real-IP`
enviados por el cliente y no depende de clientAddress de Astro.

**VPS detrás de Nginx: `INSCRIPCION_TRUST_PROXY=true`.** Usa exclusivamente
`X-Real-IP`, que el fragmento `deployment/nginx-inscripcion.conf` ya sobrescribe
con `$remote_addr`. Ignora `X-Forwarded-For` para identificar visitantes. Exige
una IP válida, no una lista ni un valor arbitrario. El modo proxy no debe usarse
si el público puede conectarse directamente a Node y fijar ese encabezado:
mantener `API_HOST=127.0.0.1` y el puerto Node inaccesible desde fuera.

No se cambió Nginx para definir límites de frecuencia. Verificar una vez que
se está usando su configuración de proxy prevista; los ajustes posteriores de
cuotas se hacen en las variables de la API. Si se añade Cloudflare u otro proxy
delante de Nginx, configurar su cadena de IP real confiable: de lo contrario
podrían agruparse visitantes bajo la IP del proxy. No confiar en encabezados
enviados por cualquier origen de Internet.

## Alcance y memoria

Los contadores son de un proceso Node y se reinician al reiniciar la API.
Con varias instancias cada una tendrá su cupo; haría falta un almacén compartido
como Redis para un límite único. Las entradas caducadas se limpian por lotes y
la tabla en memoria está acotada a 10.000 IP; al llenarse, nuevas IP reciben 429.
No se persisten IP ni se incluyen en logs de este middleware.

Esto reduce abuso de la API y trabajo en SQLite. No protege por sí solo contra
saturación del enlace del VPS o ataques a otras rutas. La API independiente
limita el cuerpo a 32 KiB durante la lectura y establece tiempos de lectura.
La protección DDoS externa y CAPTCHA son medidas adicionales pendientes.

## Pruebas

```sh
npm run test:rate-limit
npm run build
npm run test:inscripcion-integration
```

Las pruebas unitarias cubren ventana, cupos, expiración, encabezados, IP y memoria.
La integración levanta la API independiente con una base temporal, agota el cupo y
comprueba 429, `Retry-After`, rutas codificadas, ausencia de nuevas escrituras y
salida estática del sitio. También verifica el modo proxy con `X-Real-IP` fijo y
`X-Forwarded-For` cambiante. No envía inscripciones reales a Google.
