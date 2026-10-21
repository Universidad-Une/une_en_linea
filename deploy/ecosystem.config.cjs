const path = require("node:path");
const root = path.join(__dirname, "..");
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
    { ...common, name: "une-api", script: path.join(root, "server/api.mjs") },
    { ...common, name: "une-worker", script: path.join(root, "server/worker.mjs") },
  ],
};
