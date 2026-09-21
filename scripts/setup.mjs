import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { root, venvPython } from "./paths.mjs";
function run(bin, args) {
  const r = spawnSync(bin, args, { cwd: root, stdio: "inherit" });
  if (r.error || r.status !== 0) {
    console.error(r.error?.message || "Setup failed. See the error above.");
    process.exit(1);
  }
}
if (Number(process.versions.node.split(".")[0]) < 24) {
  console.error("Please install Node.js 24 or newer.");
  process.exit(1);
}
if (!fs.existsSync(venvPython)) {
  let found = false;
  for (const [cmd, prefix] of process.platform === "win32"
    ? [
        ["py", ["-3"]],
        ["python", []],
      ]
    : [
        ["python3", []],
        ["python", []],
      ]) {
    const check = spawnSync(cmd, [
      ...prefix,
      "-c",
      "import sys; sys.exit(0 if sys.version_info >= (3,11) else 1)",
    ]);
    if (check.status === 0) {
      run(cmd, [...prefix, "-m", "venv", ".venv"]);
      found = true;
      break;
    }
  }
  if (!found) {
    console.error(
      "Install Python 3.11 or newer, enable Add Python to PATH, then rerun npm run setup.",
    );
    process.exit(1);
  }
}
run(venvPython, ["-m", "pip", "install", "-r", "scraper/requirements.txt"]);
if (!fs.existsSync(path.join(root, ".env")))
  fs.copyFileSync(path.join(root, ".env.example"), path.join(root, ".env"));
console.log(
  "\nSetup complete. Run npm run dev, then open http://localhost:5173.",
);
