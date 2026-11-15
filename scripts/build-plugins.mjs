#!/usr/bin/env node
// Build the plugin package (plugins/nolang) from the sources of truth (packages/cli, skills/, agents/, hooks/).
// The manifests carry no `version`: Claude Code then takes the commit as the plugin's version, so every pushed commit
// reaches users on update (a fixed version keeps them on their copy until someone bumps it).
// The CLI body (including the docs) is not in the package — the NoLang server serves it at `agent/client/` and
// the bootstrap fetches it on every start.
// The package has no MCP connection (clients without a shell connect to the hosted MCP as a connector).
// Codex copies only the plugin directory into its cache, so the CLI (bootstrap) and the skills are real files inside the
// package (no symlinks).
// hooks/ is written for Claude Code. Codex finds hooks/hooks.json too (it asks the user once whether to trust the hooks),
// but the approval hook's decision has no effect there.
// LICENSE at the repo root is copied into the plugin package.
// `--check` writes nothing and only verifies that the package matches the sources, that it holds nothing else and that
// the manifests have no `version` or MCP connection (for CI; exits 1 on drift).
import { cp, mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const PLUGIN = "nolang";
const CLI_FILES = ["nolang.mjs", "package.json"]; // package.json carries the version the bootstrap reports
const MANIFESTS = [".claude-plugin/plugin.json", ".codex-plugin/plugin.json"]; // written by hand; the build does not touch them
// Not copied into the package
const IGNORED = new Set([".DS_Store"]);
const keep = (src) => !IGNORED.has(src.split("/").pop());

async function buildInto(pluginDir) {
  await rm(join(pluginDir, "cli"), { recursive: true, force: true });
  for (const name of CLI_FILES) await cp(join(ROOT, "packages/cli", name), join(pluginDir, "cli", name));
  // The Claude Code hooks. A plugin's hooks/hooks.json is read when the plugin is enabled
  await rm(join(pluginDir, "hooks"), { recursive: true, force: true });
  await cp(join(ROOT, "hooks"), join(pluginDir, "hooks"), { recursive: true, filter: keep });
  await rm(join(pluginDir, "skills"), { recursive: true, force: true });
  await cp(join(ROOT, "skills"), join(pluginDir, "skills"), { recursive: true, filter: keep });
  // The subagents that take the roles for `nolang make --engine subagents` (read by Claude Code only)
  await rm(join(pluginDir, "agents"), { recursive: true, force: true });
  await cp(join(ROOT, "agents"), join(pluginDir, "agents"), { recursive: true, filter: keep });
  await cp(join(ROOT, "LICENSE"), join(pluginDir, "LICENSE"));
}

async function listFiles(dir, prefix = "") {
  const found = new Map();
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (IGNORED.has(entry.name)) continue;
    const rel = prefix + entry.name;
    if (entry.isDirectory()) for (const [k, v] of await listFiles(join(dir, entry.name), rel + "/")) found.set(k, v);
    else found.set(rel, await readFile(join(dir, entry.name)));
  }
  return found;
}

async function check() {
  const real = join(ROOT, "plugins", PLUGIN);
  const tmp = await mkdtemp(join(tmpdir(), "nolang-build-"));
  try {
    // Build into an empty dir that holds only the hand-written manifests, so a file that the build does not make
    // (an MCP setting, a leftover) shows up as extra
    const expected = join(tmp, PLUGIN);
    for (const manifest of MANIFESTS) await cp(join(real, manifest), join(expected, manifest));
    await buildInto(expected);
    const [have, want] = await Promise.all([listFiles(real), listFiles(expected)]);
    const drift = [];
    for (const [path, body] of want) if (!have.has(path) || !have.get(path).equals(body)) drift.push(`${have.has(path) ? "changed" : "missing"} ${path}`);
    for (const path of have.keys()) if (!want.has(path)) drift.push(`extra ${path}`);
    for (const manifest of MANIFESTS) {
      const json = JSON.parse(have.get(manifest) ?? "{}");
      if ("mcpServers" in json) drift.push(`mcpServers in ${manifest} (the package has no MCP connection)`);
      if ("version" in json) drift.push(`version in ${manifest} (a fixed version keeps users on their copy; the commit is the version)`);
    }
    return drift;
  } finally {
    await rm(tmp, { recursive: true, force: true });
  }
}

if (process.argv.includes("--check")) {
  const drift = await check();
  if (drift.length) {
    console.error(`plugins/${PLUGIN} differs from the sources (run npm run build):\n  ${drift.slice(0, 20).join("\n  ")}${drift.length > 20 ? `\n  …and ${drift.length - 20} more` : ""}`);
    process.exit(1);
  }
  console.error(`plugins/${PLUGIN}: matches the sources`);
  process.exit(0);
}
await buildInto(join(ROOT, "plugins", PLUGIN));
console.error(`built plugins/${PLUGIN}`);
