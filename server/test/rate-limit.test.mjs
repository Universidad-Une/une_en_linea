import { test } from "node:test";
import assert from "node:assert/strict";
import { configuracionRateLimit, crearProteccionRateLimit, identificarIp } from "../rate-limit.mjs";

const defaults = configuracionRateLimit({});
// La API pasa req.headers de node:http: objeto con claves en minúsculas.
const request = (headers = {}) => headers;

test("permite cinco solicitudes, bloquea la sexta y libera al expirar", () => {
  let time = 1000;
  const check = crearProteccionRateLimit(defaults, () => time);
  for (let i = 0; i < 5; i++) assert.equal(check(request(), "192.0.2.1"), null);
  const blocked = check(request(), "192.0.2.1");
  assert.equal(blocked.status, 429);
  assert.equal(blocked.retryAfter, 60);
  assert.equal(check(request(), "192.0.2.2"), null);
  time += 59000;
  assert.equal(check(request(), "192.0.2.1").retryAfter, 1);
  time += 1000;
  assert.equal(check(request(), "192.0.2.1"), null);
});

test("la ventana es deslizante y no se reinicia en el cambio de minuto", () => {
  let time = 59000;
  const check = crearProteccionRateLimit({ ...defaults, perIp: 2 }, () => time);
  check(request(), "192.0.2.1");
  time = 60000;
  check(request(), "192.0.2.1");
  time = 61000;
  assert.equal(check(request(), "192.0.2.1").status, 429);
  time = 119000;
  assert.equal(check(request(), "192.0.2.1"), null);
  assert.equal(check(request(), "192.0.2.1").status, 429);
});

test("el cupo global limita IP distintas y los rechazos por IP no lo consumen", () => {
  const check = crearProteccionRateLimit({ ...defaults, perIp: 1, global: 2 });
  assert.equal(check(request(), "192.0.2.1"), null);
  for (let i = 0; i < 10; i++) assert.equal(check(request(), "192.0.2.1").status, 429);
  assert.equal(check(request(), "192.0.2.2"), null);
  assert.equal(check(request(), "192.0.2.3").status, 429);
});

test("en modo directo ignora XFF y X-Real-IP para impedir cambios de identidad", () => {
  const check = crearProteccionRateLimit({ ...defaults, perIp: 1 });
  assert.equal(check(request({ "x-real-ip": "203.0.113.1" }), "192.0.2.1"), null);
  assert.equal(check(request({ "x-real-ip": "203.0.113.2" }), "192.0.2.1").status, 429);
  assert.equal(check(request({ "x-forwarded-for": "203.0.113.3" }), "192.0.2.1").status, 429);
});

test("en modo proxy usa solo X-Real-IP, exige una IP válida e ignora XFF", () => {
  const check = crearProteccionRateLimit({ ...defaults, trustProxy: true, perIp: 1 });
  assert.equal(check(request({ "x-real-ip": "192.0.2.1", "x-forwarded-for": "203.0.113.1" }), "203.0.113.1"), null);
  assert.equal(check(request({ "x-real-ip": "192.0.2.1", "x-forwarded-for": "203.0.113.2" }), "203.0.113.2").status, 429);
  assert.equal(check(request({ "x-real-ip": "192.0.2.2" }), "127.0.0.1"), null);
  for (const value of ["", "no-ip", "192.0.2.1,192.0.2.2", "[::1]", "fe80::1%eth0"]) {
    assert.equal(check(request({ "x-real-ip": value }), "127.0.0.1").status, 400);
  }
});

test("normaliza IPv6 y IPv4 mapeado para compartir contador", () => {
  const check = crearProteccionRateLimit({ ...defaults, perIp: 1 });
  assert.equal(check(request(), "192.0.2.1"), null);
  assert.equal(check(request(), "::ffff:192.0.2.1").status, 429);
  assert.equal(check(request(), "::ffff:c000:201").status, 429);
  assert.equal(identificarIp(request(), "2001:0db8:0:0:0:0:0:1", false), "2001:db8::1");
});

test("limita la memoria de IP y elimina entradas vencidas", () => {
  let time = 0;
  const check = crearProteccionRateLimit({ ...defaults, maxKeys: 2 }, () => time);
  check(request(), "192.0.2.1");
  check(request(), "192.0.2.2");
  assert.equal(check(request(), "192.0.2.3").status, 429);
  time += defaults.windowMs;
  assert.equal(check(request(), "192.0.2.3"), null);
});

test("rechaza configuraciones inválidas", () => {
  for (const patch of [{ INSCRIPCION_RATE_LIMIT_PER_IP: "0" },
    { INSCRIPCION_RATE_LIMIT_GLOBAL: "NaN" }, { INSCRIPCION_RATE_LIMIT_WINDOW_MS: "-1" },
    { INSCRIPCION_RATE_LIMIT_PER_IP: "100000000" }, { INSCRIPCION_TRUST_PROXY: "yes" }]) {
    assert.throws(() => configuracionRateLimit(patch));
  }
});
