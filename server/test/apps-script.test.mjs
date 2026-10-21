import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

const source = readFileSync(
  new URL("../apps-script/recibir-inscripcion.js", import.meta.url),
  "utf8",
);
const requestId = "b4df9fde-90da-4f82-8fb6-8bc90020ff81";
const technicalItemId = 123456789;

function fixture(options = {}) {
  let submissions = 0;
  let locked = false;
  let releases = 0;
  let failAfterSave = options.failAfterSave;
  const saved = [];
  const responses = [];
  const context = {
    console: { log() {}, error() {} },
    PropertiesService: {
      getScriptProperties: () => ({
        getProperty: (key) =>
          key === "FORM_ID" ? "form-test" : key === "REQUEST_ID_ITEM_ID"
            ? (options.itemId === undefined ? String(technicalItemId) : options.itemId)
            : "s".repeat(32),
      }),
    },
    ContentService: {
      MimeType: { JSON: "json" },
      createTextOutput: (text) => ({ setMimeType: () => JSON.parse(text) }),
    },
    LockService: {
      getScriptLock: () => ({
        tryLock: () => {
          if (locked || options.busy) return false;
          locked = true;
          return true;
        },
        releaseLock: () => { locked = false; releases++; },
      }),
    },
  };
  runInNewContext(source + "\nthis.schema = CAMPOS_INSCRIPCION;", context);
  const data = {};
  // Independent snapshot of the actual Forms schema supplied by the owner.
  const types = new Map([
    [technicalItemId, options.technicalType || "TEXT"],
    [531603443, "TEXT"], [541397236, "TEXT"],
    [685898033, "TEXT"], [1781497290, "MULTIPLE_CHOICE"],
    [910929154, "TEXT"], [1898787164, "TEXT"],
    [894211712, "MULTIPLE_CHOICE"], [1017864200, "CHECKBOX"],
  ]);
  for (const [field, id, type, required] of context.schema) {
    if (required)
      data[field] =
        type === "CHECKBOX"
          ? ["Facebook"]
          : field === "programaAcademico" || type === "LIST"
            ? context.schema.find((row) => row[0] === field)[5][0]
            : type === "MULTIPLE_CHOICE"
              ? context.schema.find((row) => row[0] === field)[5][0]
              : "Prueba";
  }
  Object.assign(data, {
    telefonoContacto: "3311111111",
    correo: "test@example.com",
    edad: "25 - 34",
  });
  context.FormApp = {
    openById: () => ({
      isAcceptingResponses: () => !options.closed,
      getResponses: () => {
        assert.equal(locked, true, "La búsqueda debe ejecutarse bajo bloqueo");
        return saved.map(({ id, items }) => ({
          getId: () => id,
          getItemResponses: () => items.map(({ id, value }) => ({
            getItem: () => ({ getId: () => id }), getResponse: () => value,
          })),
        }));
      },
      getItemById: (id) => {
        if (!types.has(id) || (id === technicalItemId && options.missingItem)) return null;
        const question = {
          isRequired: () => false,
          getChoices: () =>
            context.schema
              .find((row) => row[1] === id)?.[5]
              ?.map((value) => ({ getValue: () => value })) || [],
          hasOtherOption: () => id === 1017864200,
          createResponse: (value) => ({ id, value }),
        };
        return {
          getType: () => types.get(id),
          asTextItem: () => question,
          asListItem: () => ({ ...question, hasOtherOption: undefined }),
          asDateItem: () => question,
          asMultipleChoiceItem: () => question,
          asCheckboxItem: () => question,
        };
      },
      createResponse: () => {
        const items = [];
        return {
        withItemResponse(response) {
          responses.push(response);
          items.push(response);
        },
        submit() {
          assert.equal(locked, true, "El envío debe ejecutarse bajo bloqueo");
          submissions++;
          const id = `response-test-${submissions}`;
          saved.push({ id, items });
          if (failAfterSave) { failAfterSave = false; throw new Error("Confirmación perdida después de guardar"); }
          return { getId: () => id };
        },
      }; },
    }),
  };
  return {
    data,
    responses,
    options,
    releases: () => releases,
    send: (secret = "s".repeat(32), id = requestId) =>
      context.doPost({
        postData: { contents: JSON.stringify({ secret, requestId: id, data }) },
      }),
    raw: (contents) => context.doPost({ postData: { contents } }),
    count: () => submissions,
  };
}

test("new questions submit once with the current phone", () => {
  const f = fixture();
  assert.equal(f.send().success, true);
  assert.equal(f.count(), 1);
});
test("Otro admite una respuesta personalizada", () => {
  const f = fixture(); f.data.mediosSeleccionados = ["Un medio personalizado"];
  assert.equal(f.send().success, true);
});
test("respuestas inválidas nunca se guardan", () => {
  for (const patch of [{ nombres: "" }, { programaAcademico: "Desconocido" }, { mediosSeleccionados: "Facebook" }, { mediosSeleccionados: ["Otro A", "Otro B"] }, { edad: "18 - 24" }, { correo: "nombre@dominio" }, { telefonoContacto: "123" }]) {
    const f = fixture(); Object.assign(f.data, patch);
    assert.equal(f.send().error, "INVALID_DATA"); assert.equal(f.count(), 0);
  }
});

test("unauthorized and malformed requests never submit", () => {
  const f = fixture();
  assert.equal(f.send("bad").error, "UNAUTHORIZED");
  assert.equal(f.raw("{").error, "INVALID_JSON");
  assert.equal(f.count(), 0);
});

test("guarda seis respuestas con IDs nuevos sin privacidad", () => {
  const f = fixture(); f.data.compromiso = "Sí";
  assert.equal(f.send().success, true);
  const answers = Object.fromEntries(f.responses.map(({id, value}) => [id, value]));
  assert.deepEqual(Object.keys(answers).map(Number).sort((a,b)=>a-b), [technicalItemId,685898033,1781497290,910929154,1898787164,894211712,1017864200].sort((a,b)=>a-b));
  assert.equal(answers[technicalItemId], requestId);
  assert.equal(answers[685898033], f.data.nombres);
  assert.equal(answers[1781497290], f.data.programaAcademico);
  assert.equal(answers[910929154], "3311111111");
  assert.equal(answers[1898787164], "test@example.com");
  assert.equal(answers[894211712], "25 - 34");
  assert.deepEqual(Array.from(answers[1017864200]), ["Facebook"]);
  assert.equal(answers[541670431], undefined);
});
test("contrato y validación de Astro coinciden con el receptor", async () => {
  const { CAMPOS_INSCRIPCION, validarInscripcion } = await import("../inscripcion/validacion.mjs");
  const f = fixture();
  assert.equal(CAMPOS_INSCRIPCION.length, 8);
  for (const [campo, , tipo, , , opciones] of CAMPOS_INSCRIPCION) {
    if (tipo !== "MULTIPLE_CHOICE") continue;
    for (const opcion of opciones) {
      f.data[campo] = opcion;
      assert.deepEqual(validarInscripcion(f.data).errors, {});
      assert.equal(f.send(undefined, randomUUID()).success, true);
    }
  }
});

test("guarda origen y ruta con sus IDs sin exigirlos a formularios anteriores", () => {
  const f = fixture();
  f.data.origenFormulario = "contacto";
  f.data.rutaProcedencia = "/contacto/solicitarinformacion";
  assert.equal(f.send().success, true);
  assert.equal(f.responses.length, 9);
  assert.equal(f.responses.find(({id}) => id === 531603443).value, "contacto");
  assert.equal(f.responses.find(({id}) => id === 541397236).value, "/contacto/solicitarinformacion");
});
test("no guarda metadatos con tipos o longitudes invalidos", () => {
  for (const campo of ["origenFormulario", "rutaProcedencia"]) {
    for (const valor of [123, [], "x".repeat(501)]) {
      const f = fixture(); f.data[campo] = valor;
      assert.equal(f.send().error, "INVALID_DATA"); assert.equal(f.count(), 0);
    }
  }
});

test("guarda varias casillas como una lista y rechaza vacios y duplicados", () => {
  const f = fixture(); f.data.mediosSeleccionados = ["Facebook", "Radio", "Otro"];
  assert.equal(f.send().success, true);
  assert.deepEqual(Array.from(f.responses.find(({id}) => id === 1017864200).value), ["Facebook", "Radio", "Otro"]);
  for (const mediosSeleccionados of [[], ["Facebook", "Facebook"], ["Otro A", "Otro B"]]) {
    const invalid = fixture(); invalid.data.mediosSeleccionados = mediosSeleccionados;
    assert.equal(invalid.send().error, "INVALID_DATA"); assert.equal(invalid.count(), 0);
  }
});

test("guarda texto libre en Otro junto con las casillas", () => {
  const f = fixture(); f.data.mediosSeleccionados = ["Facebook", "Una recomendacion personalizada"];
  assert.equal(f.send().success, true);
  assert.deepEqual(Array.from(f.responses.find(({id})=>id===1017864200).value), f.data.mediosSeleccionados);
});

test("el mismo UUID devuelve la confirmación original sin duplicar", () => {
  const f = fixture();
  const first = f.send();
  const second = f.send();
  assert.equal(first.success, true);
  assert.equal(second.responseId, first.responseId);
  assert.equal(second.requestId, requestId);
  assert.equal(second.deduplicated, true);
  assert.equal(f.count(), 1);
  assert.equal(f.releases(), 2);
});

test("recupera un envío guardado cuya confirmación se perdió", () => {
  const f = fixture({ failAfterSave: true });
  assert.equal(f.send().error, "FORM_SUBMISSION_FAILED");
  assert.equal(f.releases(), 1);
  const recovered = f.send();
  assert.equal(recovered.success, true);
  assert.equal(recovered.responseId, "response-test-1");
  assert.equal(recovered.deduplicated, true);
  assert.equal(f.count(), 1);
});

test("confirma un UUID anterior aunque el formulario haya cerrado o los datos cambien", () => {
  const f = fixture();
  f.send();
  f.options.closed = true;
  f.data.edad = "opción que ya no existe";
  assert.equal(f.send().success, true);
  assert.equal(f.count(), 1);
  f.data.edad = "25 - 34";
  assert.equal(f.send(undefined, randomUUID()).error, "FORM_CLOSED");
});

test("UUID distintos crean respuestas independientes", () => {
  const f = fixture();
  assert.notEqual(f.send().responseId, f.send(undefined, randomUUID()).responseId);
  assert.equal(f.count(), 2);
});

test("rechaza UUID inválidos sin guardar", () => {
  const f = fixture();
  for (const id of [null, "", "no-es-uuid", 123]) {
    assert.equal(f.send(undefined, id).error, "INVALID_REQUEST_ID");
  }
  assert.equal(f.raw(JSON.stringify({ secret: "s".repeat(32), data: f.data })).error, "INVALID_REQUEST_ID");
  assert.equal(f.count(), 0);
});

test("valida la propiedad y el tipo de la pregunta técnica sin guardar", () => {
  for (const itemId of ["", "texto", "1.2", "685898033"]) {
    const f = fixture({ itemId });
    assert.equal(f.send().error, "REQUEST_ID_NOT_CONFIGURED");
    assert.equal(f.count(), 0);
  }
  for (const options of [{ technicalType: "CHECKBOX" }, { missingItem: true }]) {
    const f = fixture(options);
    assert.equal(f.send().error, "FORM_SCHEMA_CHANGED");
    assert.equal(f.count(), 0);
  }
});

test("un bloqueo ocupado no envía ni libera el bloqueo ajeno", () => {
  const f = fixture({ busy: true });
  assert.equal(f.send().error, "RECEIVER_BUSY");
  assert.equal(f.count(), 0);
  assert.equal(f.releases(), 0);
});

test("libera el bloqueo ante validación fallida y normaliza UUID", () => {
  const f = fixture();
  f.data.correo = "invalido";
  assert.equal(f.send().error, "INVALID_DATA");
  assert.equal(f.releases(), 1);
  f.data.correo = "test@example.com";
  f.send(undefined, requestId.toUpperCase());
  assert.equal(f.send().deduplicated, true);
  assert.equal(f.count(), 1);
});
