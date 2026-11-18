#!/usr/bin/env node
// Claude Code hook (PreToolUse of Bash / Write / Read): approves, without a permission prompt, the `nolang` commands
// that cannot send a local file — so that making one video does not ask the user dozens of times (a worker takes a job
// and writes a part file again and again), and so that a question about the account or a search of NoLang's assets
// or templates does not stop. It approves exactly three things:
//   1. one plain command of this plugin's own CLI (`node <plugin>/cli/nolang.mjs …`) that cannot send a local file:
//      `auth status`, `account` with no flag (it only reads the account), `assets search <kind> '<text>'`,
//      `templates ['<text>']`,
//      `job take <dir> <tier>`, `wait <dir>`, `status <video_id> [--wait] [--until …]` (it only reads a video's state), and `make <dir>`
//      with the flags listed in MAKE_FLAGS (any `--engine`). <dir> is a directory inside the working directory. A subagent
//      (a video worker) gets only `job take`
//   2. a write of a job's part file inside the working directory (`…/stream/jobs/<job>/parts/NNN.txt`), with no symlink
//      on the way
//   3. a read of this plugin's own skill documents (they live outside the working directory)
// Everything else — an upload (`assets upload`, `make --speech`), a flag that reads a file (`make --request-file`),
// a command that changes a setting (`account --language`), another endpoint (`--api`), a command chained to something
// else, a word the shell would expand, any other file — gets no decision here and goes through the normal permission flow.
import { lstatSync, readFileSync, realpathSync } from "node:fs";
import { posix } from "node:path";
import { fileURLToPath } from "node:url";

// Split a command into words, or null unless every word is plain: each word is a run of safe bare characters, single-quoted
// text (anything but ') and double-quoted text without $ ` \ !. Then the shell turns each word into exactly the text read
// here. Anything else — another bare character (`$ { } * ? [ ~ ; & | < > ( )` …), `=` at the start of a word (zsh expands
// `=cmd`), an unclosed quote, a newline — can expand into words this hook never saw (brace / parameter / glob expansion,
// `$'…'`, `${X@P}`, a second command), so the call is left to the user
const SAFE_BARE = /[A-Za-z0-9_@%+=:,./-]/;
function approvableWords(command) {
  const words = [];
  let word = null;
  for (let i = 0; i < command.length; i++) {
    const c = command[i];
    if (c === " " || c === "\t") {
      if (word !== null) words.push(word);
      word = null;
    } else if (c === "'" || c === '"') {
      const end = command.indexOf(c, i + 1);
      if (end < 0) return null;
      const text = command.slice(i + 1, end);
      if (c === '"' && /[$`\\!]/.test(text)) return null;
      word = (word ?? "") + text;
      i = end;
    } else if (SAFE_BARE.test(c) && !(c === "=" && word === null)) {
      word = (word ?? "") + c;
    } else {
      return null;
    }
  }
  if (word !== null) words.push(word);
  return words;
}

// Do the arguments fit `positionals` (one test per positional, exact count) and `flags` (name → value test, or "bool")?
// Read the way the CLI's parseArgs reads them: `--flag value` or `--flag=value`. A value that starts with "-" is refused,
// and so is any other option (a single dash included)
function fits(args, { positionals, flags = {} }) {
  const found = [];
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (!arg.startsWith("-")) {
      found.push(arg);
      continue;
    }
    if (!arg.startsWith("--")) return false;
    const eq = arg.indexOf("=");
    const name = arg.slice(2, eq < 0 ? undefined : eq);
    if (!Object.hasOwn(flags, name)) return false;
    if (flags[name] === "bool") {
      if (eq >= 0) return false;
      continue;
    }
    const value = eq < 0 ? args[++i] : arg.slice(eq + 1);
    if (value === undefined || value.startsWith("-") || !flags[name](value)) return false;
  }
  return found.length === positionals.length && positionals.every((test, i) => test(found[i]));
}

const is = (word) => (value) => value === word;
const matches = (re) => (value) => re.test(value);
const SECONDS = matches(/^\d+$/);
const UUID = matches(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
const TIER = matches(/^[a-z]+-(low|medium|high|xhigh)$/); // the worker's tier: the CLI's `job take <dir> <tier>`

// A directory inside the working directory, with no dot segment below it (`.bashrc.d`, `.git`, `..`) and no symlink on the
// way (a cloned repository can hold `videos -> ~/.claude/rules`). The CLI prints physical paths, so the working directory
// is matched both as given and as its realpath
const runDir = (cwd) => (value) => {
  const given = String(cwd ?? "").replace(/\/+$/, "");
  if (!given.startsWith("/") || /[\\:]/.test(value)) return false;
  let real;
  try {
    real = realpathSync(given);
  } catch {
    return false;
  }
  return [given, real].some((base) => {
    const target = posix.resolve(base, value);
    const rel = posix.relative(base, target);
    if (!rel || !rel.split("/").every((segment) => segment && !segment.startsWith("."))) return false;
    // the deepest part that exists must be reached without a symlink
    let probe = target;
    while (probe !== base && !lstatSync(probe, { throwIfNoEntry: false })) probe = posix.dirname(probe);
    try {
      return realpathSync(probe) === posix.join(real, posix.relative(base, probe));
    } catch {
      return false;
    }
  });
};

// Flags of `nolang make` that carry only text or a choice (none reads a local file or changes the endpoint). `--request`
// is the request text itself; `--request-file` reads a file, so it is not here
const MAKE_FLAGS = {
  genre: matches(/^[a-z]+$/),
  mode: matches(/^[a-z]+$/),
  aspect: matches(/^\d+:\d+$/),
  seconds: matches(/^(\d+|auto)$/),
  language: matches(/^[A-Za-z-]+$/),
  engine: matches(/^(claude|codex|subagents|nolang)$/),
  request: () => true,
  editable: "bool",
};

// Flags of `nolang assets search`: the search sends only the kind, the text and these choices
const SEARCH_FLAGS = { mine: "bool", limit: SECONDS, language: matches(/^[A-Za-z-]+$/) };
const KIND = matches(/^[a-z]+$/);
// Flags of `nolang templates`: the search sends only the text and these choices
const TEMPLATE_FLAGS = { aspect: matches(/^\d+:\d+$/), language: matches(/^[A-Za-z-]+$/), limit: SECONDS };

// Is the command one plain call of this plugin's CLI that this hook approves (the list at the top)? A subagent gets only
// `job take`
export function isPlumbingCommand(command, pluginRoot, cwd, { subagent = false } = {}) {
  const root = String(pluginRoot ?? "").replace(/\/+$/, "");
  // only ASCII blanks are trimmed — the shell keeps any other leading or trailing character (NBSP, \r) in the command
  const words = approvableWords(String(command ?? "").replace(/^[ \t\n]+|[ \t\n]+$/g, ""));
  if (!root || !words || words[0] !== "node" || words[1] !== `${root}/cli/nolang.mjs`) return false;
  const [verb, ...args] = words.slice(2);
  const dir = runDir(cwd);
  if (verb === "job") return fits(args, { positionals: [is("take"), dir, TIER], flags: { timeout: SECONDS } });
  if (subagent) return false;
  if (verb === "auth") return fits(args, { positionals: [is("status")] });
  if (verb === "account") return fits(args, { positionals: [] });
  // `assets search <kind> '<text>'`, or `assets search <kind> --mine` with no text
  if (verb === "assets") return [[is("search"), KIND, () => true], [is("search"), KIND]].some((positionals) => fits(args, { positionals, flags: SEARCH_FLAGS }));
  // `templates '<text>'`, or `templates` with no text (the recommended ones)
  if (verb === "templates") return [[() => true], []].some((positionals) => fits(args, { positionals, flags: TEMPLATE_FLAGS }));
  if (verb === "wait") return fits(args, { positionals: [dir], flags: { timeout: SECONDS } });
  if (verb === "status") return fits(args, { positionals: [UUID], flags: { wait: "bool", until: matches(/^(playable|completed)$/), timeout: SECONDS } });
  if (verb === "make") return fits(args, { positionals: [dir], flags: MAKE_FLAGS });
  return false;
}

// Is the path a part file of a `nolang make` job inside the working directory? The parts directory must already exist
// (the CLI makes it before posting the job) and be reached without a symlink, and the file must not be a symlink
export function isPartFile(path, cwd) {
  const base = String(cwd ?? "").replace(/\/+$/, "");
  const file = String(path ?? "");
  if (!base.startsWith("/") || !file.startsWith(`${base}/`) || /[\\\0]/.test(file)) return false;
  const rel = file.slice(base.length + 1);
  if (!rel.split("/").every((segment) => segment && segment !== "." && segment !== "..")) return false;
  if (!/(^|\/)stream\/jobs\/[\w-]+\/parts\/\d{3}\.txt$/.test(rel)) return false;
  try {
    if (realpathSync(posix.dirname(file)) !== posix.join(realpathSync(base), posix.dirname(rel))) return false;
    const st = lstatSync(file, { throwIfNoEntry: false });
    return !st || (st.isFile() && st.nlink === 1); // not a symlink, and not a hard link to a file elsewhere
  } catch {
    return false;
  }
}

// Is the path one of this plugin's skill documents?
export function isSkillDocument(path, pluginRoot) {
  const root = String(pluginRoot ?? "").replace(/\/+$/, "");
  const file = String(path ?? "");
  if (!root.startsWith("/") || !file.startsWith(`${root}/skills/`) || /[\\\0]/.test(file)) return false;
  return file.slice(root.length + 1).split("/").every((segment) => segment && segment !== "." && segment !== "..");
}

// The reason to approve the tool call, or null to leave it to the normal permission flow. `agent_id` is set when a subagent
// makes the call (`agent_type` alone is also set on the main thread of a `claude --agent` session)
export function approval(event, pluginRoot) {
  const input = event?.tool_input ?? {};
  const subagent = Boolean(event?.agent_id);
  if (event?.tool_name === "Bash" && isPlumbingCommand(input.command, pluginRoot, event.cwd, { subagent })) return "NoLang plugin: its own nolang command (it cannot send a local file)";
  if (event?.tool_name === "Write" && isPartFile(input.file_path, event.cwd)) return "NoLang plugin: a part file of a nolang make job";
  if (event?.tool_name === "Read" && isSkillDocument(input.file_path, pluginRoot)) return "NoLang plugin: its own skill document";
  return null;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    const reason = approval(JSON.parse(readFileSync(0, "utf8")), process.env.CLAUDE_PLUGIN_ROOT);
    if (reason) process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: "PreToolUse", permissionDecision: "allow", permissionDecisionReason: reason } }) + "\n");
  } catch {
    // no decision — the normal permission flow asks the user
  }
}
