import { setTimeout as sleep } from "node:timers/promises";
import { db } from "./db/sqlite.mjs";
import { crearCola } from "./db/cola.mjs";
import { configuracionEnv, procesarTrabajo } from "./inscripcion/entrega.mjs";

const once = process.argv.includes("--once");
let stopping = false;
const wake = new AbortController();
for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => { stopping = true; wake.abort(); });
}

try {
  const config = configuracionEnv();
  const cola = crearCola(db, config);
  console.info("[Worker] Iniciado. Los logs solo incluyen UUID, intento y estado.");
  do {
    const job = cola.tomarSiguiente();
    if (job) {
      const result = await procesarTrabajo(cola, job, config);
      console.info(`[Worker:${job.id}] intento=${job.attempt} estado=${result.estado}`);
    } else if (!once && !stopping) {
      try { await sleep(config.pollMs, undefined, { signal: wake.signal }); }
      catch (error) { if (error.name !== "AbortError") throw error; }
    }
  } while (!once && !stopping);
} catch {
  console.error("[Worker] No pudo continuar. Revisa configuración, permisos y versión SQLite; el trabajo reservado se recuperará al vencer.");
  process.exitCode = 1;
} finally {
  db.close();
}
