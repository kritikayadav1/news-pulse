import { spawnSync } from "node:child_process";
import { root, pythonPath } from "./paths.mjs";
for (const [cmd, args] of [
  [
    pythonPath(),
    ["-m", "unittest", "discover", "-s", "tests", "-p", "test_*.py", "-v"],
  ],
  [process.execPath, ["--test", "tests/api.test.mjs"]],
]) {
  const result = spawnSync(cmd, args, { cwd: root, stdio: "inherit" });
  if (result.error || result.status !== 0) {
    console.error(result.error?.message || "Tests failed.");
    process.exit(result.status || 1);
  }
}
