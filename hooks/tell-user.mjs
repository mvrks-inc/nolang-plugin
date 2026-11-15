#!/usr/bin/env node
// Claude Code hook (PostToolUse / PostToolUseFailure of Bash): when nolang's output carries `tell_user` (a message with
// the video or sign-in URL), show it on the user's screen as a notification, without going through the model. The link is
// visible the moment the command returns, even if the model forgets to write it or goes on to run a long command.
// A command that exits non-zero arrives as PostToolUseFailure (its output is in `error`) — nolang exits non-zero exactly
// when the user has something to do (sign in, add credit), so both events are handled.
// A notification reads as "NoLang said this", so it is shown only when the command is one plain call of the plugin's CLI, and
// only when every URL or domain in the message is NoLang's (output of `cat file`, of `nolang …; something else`, or text
// with a link from elsewhere is never shown — a fake link must not look like a NoLang notification)
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

// The JSON objects in the output, in order. nolang prints one pretty-printed object (from a line `{` to a line `}`); on a
// failure the output also carries the exit code line and stderr around it
export function jsonObjectsOf(output) {
  const lines = String(output ?? "").split("\n").map((line) => line.trimEnd());
  const found = [];
  for (let i = 0; i < lines.length; i++) {
    let block = null;
    if (lines[i] === "{") {
      const end = lines.indexOf("}", i + 1);
      if (end < 0) break;
      block = lines.slice(i, end + 1).join("\n");
      i = end;
    } else if (lines[i].startsWith("{") && lines[i].endsWith("}")) {
      block = lines[i];
    }
    if (!block) continue;
    try {
      const value = JSON.parse(block);
      if (value && typeof value === "object") found.push(value);
    } catch {
      // not JSON — keep looking
    }
  }
  return found;
}

// The top-level `tell_user` of the last JSON object in the output that has one, or null
export function tellUserOf(output) {
  let text = null;
  for (const { tell_user: value } of jsonObjectsOf(output)) if (typeof value === "string" && value) text = value;
  return text;
}

// Split a shell command into words, or null when bash could read it as anything other than those words of one plain
// command: an unquoted `;` `&` `|` newline, redirection, parenthesis or comment, any `$` or backtick outside single quotes
// (substitution, parameter expansion — `${IFS}` splits words — and the `$'…'` / `$"…"` quotes, which this reader does
// not follow), and an unquoted `{` `}` `*` `?` `[` `~` (brace, glob and tilde expansion turn one word into others, such
// as a flag). Quoted text (the request text of `nolang make`, in single quotes as the skill says) may contain any of
// these. The hook notifies only for what this returns, so it refuses whatever it cannot read exactly as bash does
function plainWords(command) {
  const words = [];
  let word = null;
  let quote = null;
  for (let i = 0; i < command.length; i++) {
    const c = command[i];
    if (quote === "'") {
      if (c === "'") quote = null;
      else word += c;
    } else if (c === "`" || c === "$") {
      return null;
    } else if (quote === '"') {
      if (c === '"') quote = null;
      // inside double quotes a backslash escapes only these (bash keeps it before anything else)
      else if (c === "\\" && '"\\\n'.includes(command[i + 1] ?? "x")) word += command[++i];
      else word += c;
    } else if (c === "'" || c === '"') {
      quote = c;
      word ??= "";
    } else if (c === "\\" && i + 1 < command.length) {
      word = (word ?? "") + command[++i];
    } else if (c === " " || c === "\t") {
      if (word !== null) words.push(word);
      word = null;
    } else if (";&|<>()\n{}*?[~".includes(c) || (c === "#" && word === null)) {
      return null;
    } else {
      word = (word ?? "") + c;
    }
  }
  if (quote) return null;
  if (word !== null) words.push(word);
  return words;
}

// Is the command one plain call of the plugin's CLI? `node <path>/nolang.mjs …` (the plugin bootstrap), optionally after
// `cd <dir> &&` and `NAME=value` assignments, and with a trailing `2>&1`
const CD_PREFIX = /^cd\s+(?:"[^"$`\\]*"|'[^']*'|[^\s;&|<>()$`'"\\{}*?[~]+)\s*&&\s*/;
export function nolangCall(command) {
  const words = plainWords(String(command ?? "").trim().replace(CD_PREFIX, "").replace(/\s+2>&1$/, ""));
  if (!words) return null;
  const env = {};
  while (words.length && /^[A-Za-z_][A-Za-z0-9_]*=/.test(words[0])) {
    const word = words.shift();
    env[word.slice(0, word.indexOf("="))] = word.slice(word.indexOf("=") + 1);
  }
  const [first, ...rest] = words;
  const base = (word) => String(word ?? "").split("/").pop();
  // `env` = the assignments before the command, `args` = what follows nolang.mjs
  return base(first) === "node" && base(rest[0]) === "nolang.mjs" ? { env, args: rest.slice(1) } : null;
}
export const isNolangCommand = (command) => nolangCall(command) !== null;

// Is every link in the message NoLang's? URLs must be http(s) on no-lang.com or a subdomain (localhost is for local
// development), a bare domain (`example.com/login`) must be NoLang's too, and a markdown link (which can show one URL
// and open another) is refused
const NOLANG_HOST = /^(([a-z0-9-]+\.)*no-lang\.com|localhost|127\.0\.0\.1)$/;
export function onlyNolangUrls(text) {
  if (text.includes("](")) return false;
  for (const [raw] of text.matchAll(/[a-z][a-z0-9+.-]*:\/\/[^\s"'<>]+/gi)) {
    try {
      const url = new URL(raw);
      if (!/^https?:$/.test(url.protocol) || !NOLANG_HOST.test(url.hostname)) return false;
    } catch {
      return false;
    }
  }
  // a bare domain or IPv4 address (`203.0.113.5/fix`) must be NoLang's too
  for (const [, domain] of text.matchAll(/(?<![\w@/.:-])((?:[a-z0-9-]+\.)+[a-z]{2,}|\d{1,3}(?:\.\d{1,3}){3})(?![\w-])/gi)) {
    if (!NOLANG_HOST.test(domain.toLowerCase())) return false;
  }
  return true;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    const input = JSON.parse(readFileSync(0, "utf8"));
    const text = isNolangCommand(input.tool_input?.command) ? tellUserOf(input.tool_response?.stdout ?? input.error) : null;
    if (text && onlyNolangUrls(text)) process.stdout.write(JSON.stringify({ systemMessage: text }) + "\n");
  } catch {
    // the notification is a convenience — a hook failure must not stop the work
  }
}
