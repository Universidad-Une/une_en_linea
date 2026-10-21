import { test } from "node:test";
import assert from "node:assert/strict";
import { CAMPOS_INSCRIPCION, validarInscripcion } from "../inscripcion/validacion.mjs";
const valid = () => ({
  nombres: "Ana Pérez", programaAcademico: "Lic. en administracion",
  edad: "18-24", telefonoContacto: "3311111111",
  correo: "prueba@example.com", mediosSeleccionados: ["Facebook"],
});
test("conserva seis respuestas y excluye privacidad y campos antiguos", () => {
  const { data, errors } = validarInscripcion({ ...valid(), compromiso: "Sí", secret: "omitido", calleNumero: "omitido" });
  assert.deepEqual(errors, {});
  assert.deepEqual(data, { ...valid(), origenFormulario: "", rutaProcedencia: "" });
  assert.equal(CAMPOS_INSCRIPCION.length, 8);
});
test("las seis preguntas son obligatorias", () => {
  for (const [campo, , tipo, obligatorio] of CAMPOS_INSCRIPCION) {
    if (!obligatorio) continue;
    assert.equal(validarInscripcion({ ...valid(), [campo]: tipo === "CHECKBOX" ? [] : " " }).errors[campo], "REQUIRED");
  }
});
test("programas, edades y medios aceptan exactamente las opciones publicadas", () => {
  for (const [campo, , tipo, , , opciones] of CAMPOS_INSCRIPCION) {
    if (tipo !== "MULTIPLE_CHOICE") continue;
    for (const opcion of opciones) assert.deepEqual(validarInscripcion({ ...valid(), [campo]: opcion }).errors, {});
    for (const opcion of ["Desconocido", [opciones[0]], 123]) assert.ok(validarInscripcion({ ...valid(), [campo]: opcion }).errors[campo]);
  }
  for (const patch of [{ edad: "18 - 24" }, { programaAcademico: "Lic. en Administración" }, { mediosSeleccionados: "Televisión" }, { mediosSeleccionados: "Otro medio" }]) {
    assert.ok(Object.keys(validarInscripcion({ ...valid(), ...patch }).errors).length);
  }
});
test("valida teléfono y correo y rechaza payloads malformados", () => {
  for (const telefonoContacto of ["123456789", "12345678901", "+523311111111", "abcdefghij"]) assert.equal(validarInscripcion({ ...valid(), telefonoContacto }).errors.telefonoContacto, "INVALID_PHONE");
  for (const correo of ["nombre@dominio", "nombre@@dominio.com", "nombre apellido@dominio.com"]) assert.equal(validarInscripcion({ ...valid(), correo }).errors.correo, "INVALID_EMAIL");
  for (const input of [null, [], "texto"]) assert.ok(validarInscripcion(input).errors.formulario);
});

test("procedencia opcional se conserva y se valida", () => {
  const extra = { origenFormulario: "contacto", rutaProcedencia: "/contacto/solicitarinformacion" };
  assert.deepEqual(validarInscripcion({ ...valid(), ...extra }).data, { ...valid(), ...extra });
  assert.deepEqual(validarInscripcion(valid()).errors, {});
  for (const campo of Object.keys(extra)) {
    for (const valor of [123, [], "x".repeat(501)]) assert.ok(validarInscripcion({ ...valid(), [campo]: valor }).errors[campo]);
  }
});

test("medios permite varias casillas y exige opciones validas sin duplicados", () => {
  assert.deepEqual(validarInscripcion({ ...valid(), mediosSeleccionados: ["Facebook", "Radio", "Otro"] }).errors, {});
  for (const mediosSeleccionados of [[], "Facebook", ["Facebook", "Facebook"], ["Otro A", "Otro B"], [123]]) assert.ok(validarInscripcion({ ...valid(), mediosSeleccionados }).errors.mediosSeleccionados);
});

test("acepta un Otro libre y rechaza texto vacio o demasiado largo", () => {
  assert.deepEqual(validarInscripcion({ ...valid(), mediosSeleccionados: ["Facebook", "Mi medio personalizado"] }).errors, {});
  for (const mediosSeleccionados of [[" "], ["x".repeat(501)], ["Otro A", "Otro B"]]) assert.ok(validarInscripcion({ ...valid(), mediosSeleccionados }).errors.mediosSeleccionados);
});
