import { spawn } from "node:child_process";
import dotenv from "dotenv";
import path from "node:path";
import { root, pythonPath } from "./paths.mjs";
dotenv.config({ path: path.join(root, ".env"), quiet: true });
const child = spawn(pythonPath(), process.argv.slice(2), {
  cwd: root,
  stdio: "inherit",
});
child.on("error", (e) => {
  console.error(e.message, "\nRun npm run setup first.");
  process.exitCode = 1;
});
child.on("exit", (code) => {
  process.exitCode = code ?? 1;
});
