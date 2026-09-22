import { spawn } from "node:child_process";
import path from "node:path";
import { root } from "./paths.mjs";
const children = [
  spawn(process.execPath, ["--watch", "backend/src/server.js"], {
    cwd: root,
    stdio: "inherit",
  }),
  spawn(
    process.execPath,
    [path.join(root, "node_modules/vite/bin/vite.js"), "--host", "0.0.0.0"],
    { cwd: path.join(root, "frontend"), stdio: "inherit" },
  ),
];
let stopping = false;
function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  children.forEach((c) => c.kill());
  process.exitCode = code;
}
for (const c of children) {
  c.on("error", (e) => {
    console.error(e.message);
    stop(1);
  });
  c.on("exit", (code) => stop(code ?? 0));
}
process.on("SIGINT", () => stop());
process.on("SIGTERM", () => stop());
