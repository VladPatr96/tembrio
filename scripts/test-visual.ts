// scripts/test-visual.ts — run the screenshot tests the way CI does.
//
// Screenshot baselines are taken on Linux only, inside the official
// Playwright image, so fonts and anti-aliasing match CI pixel for pixel.
// This script runs that same image with Docker:
//
//   bun run test:visual             compare against the baselines
//   bun run test:visual -- --update rewrite the baselines (review the PNGs!)
//
// The container keeps its own Linux node_modules in a named volume: the host
// node_modules has Windows/macOS builds of esbuild, rollup and Tailwind.

import { spawnSync } from "child_process";
import { readFileSync } from "fs";
import { join, resolve } from "path";

const root = resolve(import.meta.dirname, "..");
const { version } = JSON.parse(
  readFileSync(
    join(root, "node_modules", "@playwright", "test", "package.json"),
    "utf8",
  ),
) as { version: string };
const bunVersion = Bun.version;
const update = process.argv.includes("--update");

const inner = [
  `npm install -g bun@${bunVersion} >/dev/null 2>&1`,
  "bun install --frozen-lockfile --ignore-scripts",
  `npx playwright test --project=visual${update ? " --update-snapshots" : ""}`,
].join(" && ");

const args = [
  "run",
  "--rm",
  "--ipc=host",
  "-e",
  "CI=1",
  "-v",
  `${root}:/work`,
  "-v",
  "tembrio-visual-node-modules:/work/node_modules",
  "-w",
  "/work",
  `mcr.microsoft.com/playwright:v${version}-noble`,
  "bash",
  "-c",
  inner,
];

console.log(
  `Playwright ${version} in Docker${update ? " (updating baselines)" : ""}…`,
);
const result = spawnSync("docker", args, { stdio: "inherit" });
if (result.error) {
  console.error(
    "Docker is needed for screenshot tests. Start Docker Desktop, or push the branch and let CI run them.",
  );
}
process.exit(result.status ?? 1);
