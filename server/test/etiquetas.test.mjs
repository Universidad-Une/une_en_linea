import { test } from "node:test";
import assert from "node:assert/strict";
import { CAMPOS_INSCRIPCION } from "../validacion.mjs";
import { ETIQUETAS_CAMPOS, ETIQUETAS_OPCIONES } from "../../src/components/inscripcion/etiquetas.mjs";

test("cada pregunta visible tiene etiqueta", () => {
  for (const [campo, , , obligatorio] of CAMPOS_INSCRIPCION) {
    if (obligatorio) assert.ok(ETIQUETAS_CAMPOS[campo], campo);
  }
});

test("las etiquetas cubren exactamente las opciones del Form", () => {
  for (const [campo, , , , , opciones] of CAMPOS_INSCRIPCION) {
    if (!opciones) continue;
    assert.deepEqual(Object.keys(ETIQUETAS_OPCIONES[campo]).sort(), [...opciones].sort(), campo);
  }
});
