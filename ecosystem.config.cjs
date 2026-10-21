const path = require("node:path");
const common = {
  cwd: __dirname,
  interpreter: "node",
  node_args: "--env-file-if-exists=.env --experimental-strip-types",
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
    { ...common, name: "une-api", script: path.join(__dirname, "api/server.mjs") },
    { ...common, name: "une-worker", script: path.join(__dirname, "scripts/inscripcion-worker.mjs") },
  ],
};
