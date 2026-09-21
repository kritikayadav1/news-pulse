import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
export const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
export const venvPython = path.join(
  root,
  ".venv",
  process.platform === "win32" ? "Scripts/python.exe" : "bin/python",
);
export function pythonPath() {
  return (
    process.env.PYTHON_BIN ||
    (fs.existsSync(venvPython)
      ? venvPython
      : process.platform === "win32"
        ? "python"
        : "python3")
  );
}
