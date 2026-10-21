import { test } from "node:test";
import assert from "node:assert/strict";
import Database from "better-sqlite3";
import { inicializarBase } from "../db.mjs";

test("el inicializador rechaza bases previas sin modificar sus tablas", () => {
  const existing = new Database(":memory:");
  try {
    existing.exec("CREATE TABLE existente (id INTEGER)");
    assert.throws(() => inicializarBase(existing), /ya tiene tablas sin versión/);
    assert.equal(existing.pragma("user_version", { simple: true }), 0);
    assert.equal(existing.prepare("SELECT count(*) AS total FROM sqlite_master WHERE type = 'table'").get().total, 1);
  } finally {
    existing.close();
  }
});
