import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { test } from "node:test";
import assert from "node:assert/strict";

const source = readFileSync(
  new URL("./recibir-inscripcion.js", import.meta.url),
  "utf8",
);
function fixture() {
  let submissions = 0;
  const responses = [];
  const context = {
    console: { log() {}, error() {} },
    PropertiesService: {
      getScriptProperties: () => ({
        getProperty: (key) =>
          key === "FORM_ID" ? "form-test" : "s".repeat(32),
      }),
    },
    ContentService: {
      MimeType: { JSON: "json" },
      createTextOutput: (text) => ({ setMimeType: () => JSON.parse(text) }),
    },
  };
  runInNewContext(source + "\nthis.schema = CAMPOS_INSCRIPCION;", context);
  const data = {};
  // Independent snapshot of the actual Forms schema supplied by the owner.
  const types = new Map([
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
      isAcceptingResponses: () => true,
      getItemById: (id) => {
        const question = {
          isRequired: () => false,
          getChoices: () =>
            context.schema
              .find((row) => row[1] === id)[5]
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
      createResponse: () => ({
        withItemResponse(response) {
          responses.push(response);
        },
        submit() {
          submissions++;
          return { getId: () => "response-test" };
        },
      }),
    }),
  };
  return {
    data,
    responses,
    send: (secret = "s".repeat(32)) =>
      context.doPost({
        postData: { contents: JSON.stringify({ secret, data }) },
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
  assert.deepEqual(Object.keys(answers).map(Number).sort((a,b)=>a-b), [685898033,1781497290,910929154,1898787164,894211712,1017864200].sort((a,b)=>a-b));
  assert.equal(answers[685898033], f.data.nombres);
  assert.equal(answers[1781497290], f.data.programaAcademico);
  assert.equal(answers[910929154], "3311111111");
  assert.equal(answers[1898787164], "test@example.com");
  assert.equal(answers[894211712], "25 - 34");
  assert.deepEqual(Array.from(answers[1017864200]), ["Facebook"]);
  assert.equal(answers[541670431], undefined);
});
test("contrato y validación de Astro coinciden con el receptor", async () => {
  const { CAMPOS_INSCRIPCION, validarInscripcion } = await import("../src/server/inscripcion.js");
  const f = fixture();
  assert.equal(CAMPOS_INSCRIPCION.length, 8);
  for (const [campo, , tipo, , , opciones] of CAMPOS_INSCRIPCION) {
    if (tipo !== "MULTIPLE_CHOICE") continue;
    for (const opcion of opciones) {
      f.data[campo] = opcion;
      assert.deepEqual(validarInscripcion(f.data).errors, {});
      assert.equal(f.send().success, true);
    }
  }
});

test("guarda origen y ruta con sus IDs sin exigirlos a formularios anteriores", () => {
  const f = fixture();
  f.data.origenFormulario = "contacto";
  f.data.rutaProcedencia = "/contacto/solicitarinformacion";
  assert.equal(f.send().success, true);
  assert.equal(f.responses.length, 8);
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
