#!/usr/bin/env node
// Claude Code hook (PostToolUse of Bash, run with `asyncRewake`): when a nolang command leaves a video generating, wait in
// the background until the video is complete (or has stopped) and wake Claude with the outcome, so that the user hears the
// video is done without having to ask. `nolang make` returns as soon as the video can play and Claude ends its turn there —
// nothing else would wake it when the video completes.
// Exit code 2 wakes Claude and shows it stderr. Everything else exits 0 and says nothing: a command that started no video,
// a video another run of this hook already watches, a video still generating at the time limit, any failure of the hook
import { execFile } from "node:child_process";
import { closeSync, mkdirSync, openSync, readFileSync, rmSync, statSync } from "node:fs";
import { tmpdir, userInfo } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { jsonObjectsOf, nolangCall, onlyNolangUrls } from "./tell-user.mjs";

// The plugin's own CLI (the bootstrap next to hooks/ in the plugin package)
const CLI = fileURLToPath(new URL("../cli/nolang.mjs", import.meta.url));
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
// How long to wait for the video. hooks.json gives this hook 3600 seconds
const WAIT_SECONDS = 3300;

// The video that a nolang command left generating — `{ videoId, api, env }` — or null. Only the commands that start a
// video or hand over more of it count (`nolang status` reports on a video without starting one)
export function generatingVideoOf(command, output) {
  const call = nolangCall(command);
  if (!call) return null;
  const [verb, sub] = call.args;
  const starts = ["make", "edit", "wait"].includes(verb) || (verb === "draft" && ["submit", "start", "continue"].includes(sub));
  if (!starts) return null;
  const result = jsonObjectsOf(output).at(-1);
  const videoId = String(result?.video_id ?? "");
  if (!result || result.ok === false || result.status === "completed" || !UUID.test(videoId)) return null;
  // the same server as the command: `--api <URL>` / `--api=<URL>`, and the assignments written before the command
  const at = call.args.findIndex((arg) => arg === "--api" || arg.startsWith("--api="));
  const api = at < 0 ? null : call.args[at].includes("=") ? call.args[at].slice("--api=".length) : (call.args[at + 1] ?? null);
  return { videoId, api, env: call.env };
}

// What to tell Claude when the wait ends, or null when the video is still generating (`status` = the output of
// `nolang status <video_id> --wait`). The sentence for the user comes from the CLI (`tell_user`, in the user's language)
// and is passed on only when every link in it is NoLang's
export function wakeMessage(videoId, status) {
  const stopped = status?.status === "failed" || status?.status === "expired";
  if (status?.status !== "completed" && !stopped) return null;
  const ours = (text) => (typeof text === "string" && text && onlyNolangUrls(text) ? text : null);
  const said = ours(status.tell_user);
  const url = ours(status.watch_url);
  const lines = [
    stopped ? `NoLang: video ${videoId} stopped before it was complete (status: ${status.status}).` : `NoLang: video ${videoId} has finished generating.`,
    "The user has not been told yet. Tell them now, in your message.",
  ];
  if (said) lines.push("Write this text as is (if the user speaks another language, translate the sentence and keep the URL line):", said);
  else if (url) lines.push(`Write the video's URL: ${url}`);
  if (!stopped && Array.isArray(status.copyright) && status.copyright.length) {
    lines.push("Pass on the credit notice too (it must be shown when the video is published):", JSON.stringify(status.copyright));
  }
  lines.push("Do not make the video again, and do not run other commands for this unless the user asks.");
  return lines.join("\n");
}

// One watcher per video and session: `draft start` and every `draft continue` report the same video, and so does a
// `wait` after a `make`. The claim is a file that stays (a later command for the same video must not start a second
// watcher after the first has finished); a claim older than the wait is left over from a run that was cut off
function claim(sessionId, videoId) {
  const dir = join(tmpdir(), `nolang-video-done-${userInfo().uid}`);
  mkdirSync(dir, { recursive: true, mode: 0o700 });
  const file = join(dir, `${String(sessionId ?? "").replace(/[^A-Za-z0-9-]/g, "") || "session"}-${videoId}`);
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      closeSync(openSync(file, "wx"));
      return true;
    } catch {
      if (Date.now() - statSync(file).mtimeMs < (WAIT_SECONDS + 300) * 1000) return false;
      rmSync(file, { force: true });
    }
  }
  return false;
}

// `nolang status <video_id> --wait` → its JSON, or null. The CLI exits non-zero for a video that failed — its output is read all the same
function waitForStatus({ videoId, api, env }, cwd, cli = CLI) {
  const args = [cli, "status", videoId, "--wait", "--timeout", String(WAIT_SECONDS), ...(api ? ["--api", api] : [])];
  return new Promise((resolve) => {
    execFile(process.execPath, args, { cwd: cwd || undefined, env: { ...process.env, ...env }, maxBuffer: 4 * 1024 * 1024 }, (_error, stdout) => {
      resolve(jsonObjectsOf(stdout).at(-1) ?? null);
    });
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  let code = 0;
  try {
    const input = JSON.parse(readFileSync(0, "utf8"));
    const video = generatingVideoOf(input.tool_input?.command, input.tool_response?.stdout);
    if (video && claim(input.session_id, video.videoId)) {
      const message = wakeMessage(video.videoId, await waitForStatus(video, input.cwd));
      if (message) {
        process.stderr.write(message + "\n");
        code = 2;
      }
    }
  } catch {
    // the notice is a convenience — a hook failure must not disturb the session
  }
  process.exit(code);
}
