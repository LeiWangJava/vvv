# Agent compatibility

Vibe Vision Video is an [Agent Skill](https://agentskills.io): the `skills/vvv` directory, with its `SKILL.md`, helper scripts and references. Any agent that reads Agent Skills can load it. Its helpers also need the template kit (`kits/remotion`) and, on the machine that renders, Python 3.9+ with Pillow, Node.js 26 and npm.

## Install

Pick one route.

1. **Claude Code plugin (includes the kit).** In Claude Code 2.1.275 or later:

   ```text
   /plugin install vvv --marketplace actionow-ai/vvv
   ```

   On older versions, run `/plugin marketplace add actionow-ai/vvv`, then `/plugin install vvv@vibevision`. The skill appears as `/vvv:vvv`, or just describe the film you want. The whole repository (about 120 MB) is copied into Claude Code's plugin cache, so the helpers find the kit there; projects are created elsewhere, so the cache is never edited.

2. **Any agent: `npx skills`.** The [skills CLI](https://github.com/vercel-labs/skills) (Node 22.20+) installs the skill into the folders your agents read:

   ```sh
   npx skills add actionow-ai/vvv              # this project; -g for every project, -a to pick agents
   ```

   It installs the skill directory only, so also clone the repository and point the helpers at its kit (see below).

3. **Copy or link it yourself.** Clone the repository and copy (or symlink) `skills/vvv` into the folder your agent reads, from the table below. `.agents/skills/vvv` is read by most agents; Claude Code uses `.claude/skills/vvv`.

4. **Codex: built-in installer.** Ask Codex for `$skill-installer https://github.com/actionow-ai/vvv/tree/main/skills/vvv`. It installs to `~/.codex/skills/vvv`, which Codex still reads.

5. **WorkBuddy: skill ZIP.** Download `vvv-skill.zip` from [Releases](https://github.com/actionow-ai/vvv/releases) and choose **技能 → 添加技能 → 上传技能**. See [WorkBuddy](workbuddy.md).

### How the helpers find the kit

Commands that need the kit (`templates`, `describe`, `init`, `pack`) use, in order: `--kit PATH`, the `VVV_KIT` environment variable, then the `kits/remotion` directory beside the skill (a clone or the Claude Code plugin). When the skill was copied on its own, set the variable once:

```sh
export VVV_KIT=/path/to/vvv/kits/remotion
```

Without any of them, commands stop with `KIT_REQUIRED` and say how to fix it.

## Hosted MCP server

Agents that speak MCP can also connect to `https://mcp.vibevision.video/mcp` (Streamable HTTP, no account). It lists the templates, describes each one's photo slots and copy fields, links template packages and serves the craft, recreation and review guides; rendering still happens locally with the skill. In Claude Code: `claude mcp add --transport http vvv https://mcp.vibevision.video/mcp`. Setup for Codex, Cursor, VS Code, Gemini CLI and Windsurf is on the [website](https://vibevision.video/start/#mcp).

## Where each agent looks

Checked against each agent's documentation on 2026-10-22; folder conventions change, so confirm with your agent's docs. "Untested" means the agent reads Agent Skills from these folders, but Vibe Vision Video has not been run end to end in it.

| Agent | Project folder | Personal folder | Status |
|---|---|---|---|
| Claude Code | `.claude/skills/`, or the plugin | `~/.claude/skills/` | Tested on macOS ARM64 |
| Codex | `.agents/skills/` | `~/.agents/skills/` | Tested on macOS ARM64 |
| WorkBuddy | ZIP upload; `.codebuddy/skills/` | — | Package checks only |
| CodeBuddy (IDE, CLI) | `.codebuddy/skills/` | `~/.codebuddy/skills/` | Untested |
| Gemini CLI | `.agents/skills/`, `.gemini/skills/` | `~/.agents/skills/`, `~/.gemini/skills/` | Untested |
| GitHub Copilot | `.agents/skills/`, `.github/skills/`, `.claude/skills/` | `~/.copilot/skills/`, `~/.agents/skills/` | Untested |
| Cursor | `.agents/skills/`, `.cursor/skills/`, `.claude/skills/` | `~/.cursor/skills/`, `~/.agents/skills/` | Untested |
| OpenCode | `.agents/skills/`, `.opencode/skills/`, `.claude/skills/` | `~/.config/opencode/skills/` | Untested |
| Windsurf / Devin Desktop | `.agents/skills/`, `.devin/skills/` | `~/.agents/skills/` | Untested |
| Cline | `.cline/skills/`, `.claude/skills/` | `~/.cline/skills/` | Untested |
| Roo Code | `.agents/skills/`, `.roo/skills/` | `~/.agents/skills/`, `~/.roo/skills/` | Untested |
| Amp | `.agents/skills/`, `.claude/skills/` | `~/.agents/skills/` | Untested |
| Goose | `.agents/skills/`, `.claude/skills/` | `~/.agents/skills/` | Untested |
| Factory Droid | `.agents/skills/`, `.factory/skills/` | `~/.agents/skills/`, `~/.factory/skills/` | Untested |
| Kiro | `.kiro/skills/` | `~/.kiro/skills/` | Untested |
| Qwen Code | `.qwen/skills/` | `~/.qwen/skills/` | Untested |
| Trae | `.agents/skills/`, `.trae/skills/` | `~/.trae/skills/` (China build: `~/.trae-cn/skills/`) | Untested |
| Qoder | `.qoder/skills/` | `~/.qoder/skills/` | Untested |
| Kimi Code CLI | `.agents/skills/`, `.kimi-code/skills/` | `~/.agents/skills/` | Untested |
| Augment (Auggie CLI) | `.agents/skills/`, `.augment/skills/`, `.claude/skills/` | `~/.augment/skills/` | Untested |
| Junie | `.agents/skills/` (trusted projects), `.junie/skills/` | `~/.agents/skills/` | Untested |
| Mistral Vibe | `.agents/skills/` (trusted folders), `.vibe/skills/` | `~/.agents/skills/` | Untested |
| OpenHands | `.agents/skills/` | `~/.agents/skills/` | Untested |
| Zed | `.agents/skills/` (trusted worktrees) | `~/.agents/skills/` | Untested |
| Google Antigravity | `.agents/skills/` | `~/.gemini/config/skills/` | Untested |

The skill runs local commands (`python3`, `node`, `npm`), so the agent needs terminal access. Some agents (Copilot, Kiro, Zed and others) ask before each shell command; allow the helper commands for the project.

## What an installation proves

The skill appearing in your agent's list shows discovery only. Rendering, image generation and your own review are separate checks, and a result applies to the agent, version and machine it was tried on. Reports from other agents are welcome as issues.
