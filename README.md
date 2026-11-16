# NoLang Skill (Claude Code / Codex plugin · MCP connector)
English | [日本語](README.ja.md)

**[NoLang](https://no-lang.com)** is an AI video generation service: you describe a video in plain words and it makes one with a script, narration, pictures and BGM. With this plugin you ask Claude Code or Codex for a video and get back a link to watch it.

1. Install the plugin (one command, under "Install" below) and restart Claude Code / Codex.
2. Ask: "Make a 60-second video introducing what you can do with NoLang, the AI video generator".
3. The first time, you are asked to sign in to NoLang in the browser. You need a NoLang account (it can be created on that screen; plans and prices: https://no-lang.com/pricing). A watch link appears in 1–2 minutes, and the video is kept in your NoLang account.

**NoLang Skill** is the name for the two ways to use NoLang from AI agents: this plugin and the MCP connector. This repository distributes the plugin (Apache-2.0).

The way depends on the AI tool. Install only one per AI tool: the plugin or the MCP connector.

| AI tool | Way |
|---|---|
| Claude Code | Plugin |
| Codex (the CLI, the Codex app, the Codex in the ChatGPT desktop app; the IDE extension does not support plugins) | Plugin |
| The Claude desktop app (Code tab, Cowork) | Plugin (we recommend also installing the Claude Code CLI) |
| claude.ai, the ChatGPT app, Gemini, Cursor and other clients | MCP connector `https://api.no-lang.com/agent/mcp` |

## Install (once)

The plugin needs **Node.js 20 or later** (Claude Code does not include it; install it from [nodejs.org](https://nodejs.org/)). For the MCP connector, install nothing; just add it to your app.

The easiest way is to ask your agent: "Install the NoLang plugin (mvrks-inc/nolang-plugin)". It follows "Installing for an agent" at the end. To do it yourself:

**Claude Code** (one line in a terminal)

```
claude plugin install nolang --marketplace mvrks-inc/nolang-plugin
```

Inside Claude Code you can also use `/plugin marketplace add mvrks-inc/nolang-plugin` and `/plugin install nolang@nolang`.

**Turn on auto-update** (recommended): Claude Code does not update plugins from third-party marketplaces unless you ask it to. In Claude Code, open `/plugin` → Marketplaces → `nolang` → Enable auto-update. A new version then arrives on its own and loads in the next session.

**The Claude desktop app (Code tab)**: ask Claude in the Code tab as above, then open a new session. We recommend also installing the Claude Code CLI and signing in once: with the CLI, playback of a video starts sooner. Install it in a terminal with the command below, then run `claude` once and sign in with your claude.ai account.

```
curl -fsSL https://claude.ai/install.sh | bash        # macOS / Linux / WSL
irm https://claude.ai/install.ps1 | iex               # Windows PowerShell
```

With the CLI installed, the one line for Claude Code above also installs the plugin for the desktop app (they read the same settings).

**Cowork**: the agent in Cowork cannot install plugins. Open Customize → Plugins → Add marketplace, enter `mvrks-inc/nolang-plugin` and install `nolang` (paid plans). Cowork blocks other domains by default: in Settings → Capabilities, add `api.no-lang.com` and `no-lang.com` to the allowed domains (on Team / Enterprise, an admin sets this).

**Codex**

```
codex plugin marketplace add mvrks-inc/nolang-plugin
codex plugin add nolang@nolang
```

You can also use `/plugins` → Add Marketplace inside Codex. Restart after installing (in Claude Code, `/reload-plugins` also works).

### Requirements and limits

- The plugin has your own Claude Code or Codex write the script. Claude Code needs to be signed in with a claude.ai subscription. With API-key-only, Bedrock or Vertex setups, or when the `claude` / `codex` command cannot be used, the plugin has the AI of the current session write the draft instead.
- Corporate HTTP proxies are not supported.
- On every start, the plugin fetches the program body from `api.no-lang.com`, verifies its signature and runs it. A body with no signature, or with a signature that does not match, is not run.
- The routine steps of making a video (checking the status, writing the draft, and so on), reading your account and searching NoLang's assets and templates run without a permission prompt. Anything that can send a local file still goes through Claude Code's normal permission prompt.
- For questions and problems, open an issue at https://github.com/mvrks-inc/nolang-plugin/issues. Attach the result of asking your agent to "run nolang doctor", or the watch URL.

## Sign in (once)

Ask Claude Code to "Sign in to NoLang" (if you don't, it asks you the first time you request a video). An approval URL appears (on the same machine, a browser also opens). Sign in to NoLang, press "Allow", and reply "I allowed it" to Claude Code. Over SSH or in a remote environment, enter the URL and the code shown in a browser and approve. The login expires if it is not used for 30 days.

Apps that use the MCP connector (claude.ai, etc.) sign in when you add `https://api.no-lang.com/agent/mcp` as a connector and connect.

## Make a request

```
Make a 60-second video introducing what you can do with NoLang, the AI video generator
Use this photo (~/Desktop/product.png) as the background and make a vertical video introducing our new product
Make a video explaining tips for working from home, with a calm female voice and piano BGM
```

- A watch URL appears in 1–2 minutes. In Claude Code, the link also appears in a notification, before the agent's reply. You can play the video while it is still being generated; the rest grows while you watch. In Claude Code, the agent also tells you when the video is complete.
- If you ask for a vertical video or state a length, you get that. If you don't, the video is 16:9 and the length is set to fit the content. The video is made in the language of your request (ask in English and you get an English video. For a different language, write something like "in Japanese").
- Local photos and videos are uploaded as your own assets and used in the video. Voice, BGM, sound effects and fonts are chosen from descriptions (to decide yourself, say "find candidates for a ... voice").
- To make a video in the form of a NoLang template, say something like "find a template for a product introduction and make it with that". "Make it like this video" with the URL of one of your own videos works the same way.
- If you want the finished mp4, say "give me the mp4 link when it's done". "Fix this part of this video" makes a fixed video and keeps the original video.

### Troubleshooting

| Symptom | What to do |
|---|---|
| You opened the sign-in URL too late | It waits for the time written in the sign-in message. After that, say "Sign in to NoLang" again |
| You are told "claude is not found" / "codex is not found" | Nothing to do: the plugin has the AI of this session write the draft instead. In the Claude desktop app, installing the Claude Code CLI ("Install" above) makes later videos start sooner |
| Cannot connect / something seems wrong | Ask "run nolang doctor" and open an issue with the result (https://github.com/mvrks-inc/nolang-plugin/issues) |
| Generation fails / there is no voice | This is usually on the server side. Open an issue with the watch URL |
| You are told you reached the limit on videos generating at the same time | Wait for the previous video to finish (how many can be generating at once depends on the plan) |

## Update

The program body is shipped by the NoLang server, and the plugin fetches the latest one on every start. Normally you do nothing.

With auto-update on (see Install), Claude Code updates the plugin itself on its own and the new version loads in the next session. Otherwise, when a newer plugin exists, the update command is added once a day to a message such as the video link. To update by hand:

```
claude plugin marketplace update nolang
claude plugin update nolang@nolang
```

Then restart Claude Code (or run `/reload-plugins`). Your login is kept. Codex: `codex plugin marketplace upgrade nolang` → `codex plugin remove nolang@nolang` → `codex plugin add nolang@nolang` → restart.

## Installing for an agent

Steps for an AI agent asked to "install the NoLang plugin". Run each command as a plain command and tell the user what they need to do at the end.

1. **Claude Code with a `claude` command** (the terminal, or the desktop app with the CLI installed): `claude plugin install nolang --marketplace mvrks-inc/nolang-plugin`. The install writes `extraKnownMarketplaces.nolang` to the user settings `~/.claude/settings.json` (Windows: `%USERPROFILE%\.claude\settings.json`); add `"autoUpdate": true` to that entry, next to `source`, keeping everything else (this turns on auto-update). Then ask the user to run `/reload-plugins` or start a new session.
2. **The Claude desktop app's Code tab with no `claude` command**: add these two keys (with auto-update on) to the user settings `~/.claude/settings.json` (Windows: `%USERPROFILE%\.claude\settings.json`). Keep everything else in the file; create it if it does not exist. Claude Code fetches the plugin when the next session starts, so ask the user to open a new session. Then ask the user whether to also install the Claude Code CLI (recommended; see "Install" above). If they agree, run `curl -fsSL https://claude.ai/install.sh | bash` (Windows PowerShell: `irm https://claude.ai/install.ps1 | iex`) and ask them to run `claude` once in a terminal and sign in with their claude.ai account before they open the new session.

   ```json
   {
     "extraKnownMarketplaces": { "nolang": { "source": { "source": "github", "repo": "mvrks-inc/nolang-plugin" }, "autoUpdate": true } },
     "enabledPlugins": { "nolang@nolang": true }
   }
   ```
3. **Codex**: `codex plugin marketplace add mvrks-inc/nolang-plugin`, then `codex plugin add nolang@nolang`, then ask the user to start a new session.
4. **Cowork, claude.ai and other apps**: you cannot install it yourself. Give the user the Cowork steps under "Install" above, or, for apps without the plugin, the MCP connector URL `https://api.no-lang.com/agent/mcp`.
5. **`node` is missing** (`node --version` fails or is below 20): ask the user to install Node.js 20 or later from https://nodejs.org/ (or with their package manager) before the first video.
