const fs = require("node:fs");
const path = require("node:path");
const root = path.join(__dirname, "..");

// APP_ENV=preview en el .env del proyecto usa nombres propios para no tocar los
// procesos de producción, que corren en el mismo servidor (ver deploy/entorno.sh).
function leerEnv(nombre) {
  try {
    const linea = fs.readFileSync(path.join(root, ".env"), "utf8").match(new RegExp(`^${nombre}=(.*)$`, "m"));
    return linea ? linea[1].trim().replace(/^["']|["']$/g, "") : undefined;
  } catch {
    return undefined;
  }
}
// El .env del proyecto manda, igual que en deploy.sh.
const sufijo = (leerEnv("APP_ENV") ?? process.env.APP_ENV) === "preview" ? "-preview" : "";

const common = {
  cwd: root,
  interpreter: "node",
  node_args: "--env-file-if-exists=.env",
  instances: 1,
  exec_mode: "fork",
  autorestart: true,
  watch: false,
  restart_delay: 3000,
  kill_timeout: 30000,
  time: true,
};
module.exports = {
  apps: [
    { ...common, name: `une-api${sufijo}`, script: path.join(root, "server/api.mjs") },
    { ...common, name: `une-worker${sufijo}`, script: path.join(root, "server/worker.mjs") },
  ],
};
