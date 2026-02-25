# CodeCLI

**AI-Powered Coding Assistant for the Terminal** — A Claude Code-like CLI that works with Azure OpenAI, Ollama, and Google Gemini.

<p align="center">
  <img src="https://img.shields.io/badge/Node.js-18+-green?logo=node.js" alt="Node.js">
  <img src="https://img.shields.io/badge/License-MIT-blue" alt="License">
  <img src="https://img.shields.io/badge/version-1.0.0-purple" alt="Version">
</p>

---

## Features

- 🤖 **Multi-Provider AI** — Azure OpenAI, Ollama (local), and Google Gemini
- 🔧 **Built-in Tools** — File read/write, code search, terminal commands, directory listing
- 💬 **Interactive REPL** — Rich terminal UI with streaming responses and markdown rendering
- 🔀 **Session Management** — Save, resume, and continue conversations
- 🧠 **Auto-Compaction** — Automatically summarizes context when approaching token limits
- 📦 **Skills System** — Extensible skill packs for specialized workflows
- 🌿 **Git Integration** — Smart commits, diffs, branch management
- 🤝 **Agent Teams** — Orchestrate multiple AI agents for complex tasks
- 🔌 **MCP Protocol** — Connect to external tool servers
- ⚡ **Tab Completion** — Auto-complete slash commands with Tab

---

## Installation

### Prerequisites

- [Node.js](https://nodejs.org/) v18 or higher
- An API key for at least one provider (Azure OpenAI, Ollama, or Gemini)

### Install

```bash
# Clone the repository
git clone <your-repo-url>
cd claude

# Install dependencies
npm install

# Install globally
npm install -g .
```

### Configuration

CodeCLI stores settings in `~/.codecli/config.json`. The first time you run `codecli`, the tool pauses to gather credentials for at least one provider (Azure OpenAI, Gemini, or Ollama) before letting you continue. Defaults such as `gpt-4o`, `gemini-2.0-flash`, or `http://localhost:11434` are offered, but you must explicitly accept or update them so the CLI knows what to use.

During setup, use the arrow keys (or press 1/2/3) to pick a provider and hit Enter to accept the highlighted default (for example, the Ollama host defaults to `http://localhost:11434`).

You can also manage credentials directly with the `codecli config` command or the `/config` slash command:

```bash
codecli config set providers.azure-openai.apiKey <your-key> --global
codecli config set providers.azure-openai.endpoint https://your-resource.openai.azure.com --global
codecli config set providers.azure-openai.deployment gpt-4o --global
codecli config set providers.gemini.apiKey <your-gemini-key> --global
codecli config set providers.ollama.host http://localhost:11434 --global
codecli config set providers.ollama.model llama3.2 --global
codecli config set defaultProvider gemini --global
```

Toggle experimental features the same way:

```bash
codecli config set experimental.agentTeams true --global
codecli config set experimental.mcp true --global
```

Drop the `--global` flag to keep settings inside the current repository (`.codecli.json`), or revisit the interactive prompt by deleting `~/.codecli/config.json` and restarting.

Inside the REPL, `/provider list` shows each provider’s configured fields and `/provider configure` re-triggers the same onboarding prompts (arrow keys + Enter accept defaults).

---

## Quick Start

```bash
# Start interactive mode
codecli

# Start with an initial prompt
codecli "Explain the structure of this project"

# Use a specific provider and model
codecli -p gemini -m gemini-2.0-flash "Refactor this file"

# Run in headless mode (non-interactive, single response)
codecli --headless "Generate a .gitignore for Node.js"

# Continue the most recent conversation
codecli -c

# Resume a specific session
codecli -r <session-id>
```

---

## CLI Flags

| Flag | Description |
|------|-------------|
| `[prompt]` | Initial prompt to start with |
| `-c, --continue` | Continue the most recent conversation |
| `-r, --resume <id>` | Resume a specific session by ID |
| `-m, --model <model>` | Specify the model to use |
| `-p, --provider <name>` | Provider: `azure-openai`, `ollama`, or `gemini` |
| `--system-prompt <text>` | Set a custom system prompt |
| `--system-prompt-file <file>` | Load system prompt from a file |
| `--append-system-prompt <text>` | Append to the system prompt |
| `--output-format <fmt>` | Output format: `text` or `json` |
| `--add-dir <dirs...>` | Add additional working directories |
| `--think` | Enable extended thinking mode |
| `--image <path>` | Include an image for analysis |
| `--headless` | Non-interactive mode (single prompt/response) |
| `--verbose` | Enable debug logging |

---

## Slash Commands

Type these inside the interactive REPL. Press **Tab** after typing `/` to see autocomplete suggestions.

### Core Commands

#### `/help`
Display all available commands, special syntax, and keyboard shortcuts.
```
❯ /help
```

#### `/clear`
Clear the conversation history and start fresh.
```
❯ /clear
```

#### `/compact`
Manually compact the conversation to free up context window space. CodeCLI also auto-compacts at 75% usage.
```
❯ /compact
```

#### `/model`
Switch the AI model or provider mid-conversation.
```
# List available models
❯ /model list

# Switch to a specific model
❯ /model gpt-4o

# Switch provider and model
❯ /model gemini gemini-2.0-flash
```

#### `/config`
View and modify configuration settings.
```
# List all config
❯ /config list

# Get a specific value
❯ /config get temperature

# Set a value
❯ /config set temperature 0.9

# Set globally (applies to all projects)
❯ /config set temperature 0.9 --global
```

#### `/status`
Display current session info — provider, model, token usage, message count.
```
❯ /status
```

#### `/provider`
Inspect and refresh provider credentials without touching files.
```
❯ /provider list
❯ /provider configure
❯ /provider configure gemini
```
The prompts mirror the onboarding flow—use arrow keys (or 1/2/3) to pick the provider and press Enter to accept defaults such as Ollama’s `http://localhost:11434`.

---

### Session Commands

#### `/rewind`
Undo the last N conversation turns.
```
# Undo the last turn
❯ /rewind

# Undo the last 3 turns
❯ /rewind 3
```

#### `/review`
Ask the AI to review recent changes or a specific file.
```
# Review recent changes
❯ /review

# Review a specific file
❯ /review src/index.js
```

#### `/tasks`
Manage a task list for tracking work.
```
# List tasks
❯ /tasks

# Add a task
❯ /tasks add Fix login bug

# Complete a task
❯ /tasks done 1

# Remove a task
❯ /tasks remove 2
```

#### `/init`
Initialize a `CODECLI.md` project context file in the current directory. This file is automatically loaded on startup to give the AI context about your project.
```
❯ /init
```

---

### Git Commands

#### `/git`
Full Git integration available inside the REPL.

```
# Check repository status
❯ /git status

# View recent commits
❯ /git log

# View diff of staged/unstaged changes
❯ /git diff

# List branches
❯ /git branch

# Create a new branch
❯ /git new-branch feature/my-feature

# Stage all changes
❯ /git stage

# AI-powered smart commit (auto-generates commit message)
❯ /git smart-commit

# Stage + smart commit in one step
❯ /git autocommit
```

**Smart Commit** analyzes your diff and generates a conventional commit message (e.g., `feat: add user authentication`).

---

### Skills System

Skills are extensible instruction packs that augment the AI's behavior for specialized workflows (e.g., deployment, testing, code review).

#### `/skills`
Manage skills:
```
# List all discovered skills
❯ /skills list

# Activate a skill (its instructions are injected into AI context)
❯ /skills activate deploy

# Deactivate a skill
❯ /skills deactivate deploy

# View a skill's full content
❯ /skills view deploy

# Create a new skill from template
❯ /skills create my-workflow

# Re-scan for skills
❯ /skills refresh
```

#### Creating a Skill

Run `/skills create <name>` or manually create the directory structure:

```
.agent/skills/deploy/
├── SKILL.md          # Required — instructions with YAML frontmatter
├── scripts/          # Optional — helper scripts
├── examples/         # Optional — reference implementations
└── resources/        # Optional — templates, configs, assets
```

**SKILL.md format:**
```markdown
---
name: deploy
description: Deploy the application to production
---

# Deploy Workflow

## Steps

1. Run tests: `npm test`
2. Build production bundle: `npm run build`
3. Deploy to server: `./scripts/deploy.sh`

## Important Notes

- Always run tests before deploying
- Check the staging environment first
```

**Skill locations** (searched in order):
1. `<project>/.agent/skills/` — project-specific skills
2. `<project>/skills/` — alternative project location
3. `<global-config>/skills/` — shared across all projects

**Auto-activation**: Skills are automatically activated when your prompt contains matching keywords from the skill's name or description.

---

### Agent & Team Commands

#### `/agent`
Spawn a focused subagent for a specific task. Subagents have their own context and tools.
```
# Spawn a subagent with a task
❯ /agent Refactor the authentication module to use JWT tokens

# List active agents
❯ /agent list
```

#### `/team`
Orchestrate multiple agents working together on a complex objective. Enable with `/config set experimental.agentTeams true --global`.
```
# Run a team on a complex task
❯ /team Implement a full REST API with CRUD operations for users, products, and orders

# List active teams
❯ /team list
```

---

### MCP (Model Context Protocol)

Connect to external tool servers using MCP. Enable with `/config set experimental.mcp true --global`.

#### `/mcp`
```
# Connect to an MCP server
❯ /mcp connect my-server http://localhost:3001

# List connected servers
❯ /mcp list

# View available tools from connected servers
❯ /mcp tools

# Disconnect a server
❯ /mcp disconnect my-server
```

---

## Special Syntax

### Shell Commands (`!`)

Execute any shell command directly without leaving the REPL:

```
❯ ! npm test
❯ ! git status
❯ ! ls -la src/
❯ ! python script.py
```

### File References (`@`)

Include file contents directly in your prompt:

```
❯ @src/index.js explain this file
❯ @package.json what dependencies do we use?
❯ Refactor @src/utils.js to use async/await
```

Files over 10,000 characters are automatically truncated.

### Extended Thinking (`>`)

Enable extended thinking for the next response — uses higher temperature and more tokens:

```
❯ > ultrathink
  🧠 Extended thinking enabled for next response
❯ Design a scalable microservice architecture for an e-commerce platform
```

---

## AI Tools

CodeCLI gives the AI access to these built-in tools:

| Tool | Description |
|------|-------------|
| **read_file** | Read file contents with line numbers |
| **write_file** | Create or overwrite files |
| **edit_file** | Apply surgical edits to existing files |
| **run_command** | Execute shell commands |
| **search_code** | Regex search across project files |
| **search_files** | Find files by name pattern |
| **list_directory** | List directory contents |

The AI uses these tools automatically based on your requests. You'll see tool execution with icons:

```
──── Tool Execution ────
📄 read_file src/index.js (0.3s)
  ✓ 145 lines

⚡ run_command npm test (2.1s)
  ✓ All tests passed
────────────────────────
```

---

## Sub-Commands

These are used outside the REPL from your terminal:

### `codecli config`
```bash
# List all config
codecli config list

# Get a specific value
codecli config get temperature

# Set a value
codecli config set temperature 0.9
```

### `codecli sessions`
```bash
# List all saved sessions
codecli sessions
```

### `codecli mcp`
```bash
# Manage MCP servers from CLI
codecli mcp connect my-server http://localhost:3001
codecli mcp list
codecli mcp disconnect my-server
```

---

## Project Context

Create a `CODECLI.md` file in your project root (or run `/init`) to automatically give the AI context about your project:

```markdown
# My Project

## Tech Stack
- Node.js with Express
- PostgreSQL database
- React frontend

## Conventions
- Use TypeScript strict mode
- Follow ESLint airbnb config
- Write unit tests for all new functions

## Important Files
- `src/server.ts` — main entry point
- `src/routes/` — API routes
- `src/models/` — database models
```

This file is automatically loaded at startup and included in every conversation.

---

## Token Management

CodeCLI tracks token usage and automatically manages context window limits:

- **Per-model limits** — Automatically detects context window size (e.g., 16K for GPT-3.5, 128K for GPT-4o)
- **Auto-compaction** — At 75% context usage, older messages are automatically summarized
- **Manual compaction** — Use `/compact` to manually free up space
- **Usage display** — Token usage shown every 3 turns

---

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| **Tab** | Auto-complete slash commands |
| **Ctrl+C** | Cancel current response |
| **Ctrl+D** | Exit CodeCLI |
| **Up/Down** | Navigate input history |

---

## Architecture

```
codecli/
├── bin/codecli.js          # CLI entry point (commander.js)
├── src/
│   ├── index.js            # Main CodeCLI class
│   ├── config.js           # Configuration management
│   ├── session.js          # Session save/load/resume
│   ├── context.js          # System prompt & token management
│   ├── permissions.js      # Tool permission system
│   ├── skills.js           # Skills discovery & management
│   ├── providers/
│   │   ├── manager.js      # Provider switching & model limits
│   │   ├── base.js         # Base provider class
│   │   ├── azure-openai.js # Azure OpenAI provider
│   │   ├── ollama.js       # Ollama (local) provider
│   │   └── gemini.js       # Google Gemini provider
│   ├── tools/
│   │   ├── executor.js     # Tool execution engine
│   │   ├── file-read.js    # Read file tool
│   │   ├── file-write.js   # Write/edit file tool
│   │   ├── file-search.js  # File search tool
│   │   ├── code-search.js  # Code/regex search tool
│   │   ├── list-dir.js     # Directory listing tool
│   │   └── terminal.js     # Shell command tool
│   ├── commands/           # All slash commands
│   ├── ui/
│   │   ├── repl.js         # Interactive REPL loop
│   │   ├── renderer.js     # Markdown & banner rendering
│   │   ├── spinner.js      # Animated thinking spinner
│   │   └── theme.js        # Color palette & visual elements
│   ├── experimental/
│   │   ├── subagent.js     # Subagent spawning
│   │   ├── agent-teams.js  # Multi-agent orchestration
│   │   ├── mcp.js          # MCP protocol client
│   │   └── git-integration.js  # Git operations
│   └── utils/
│       ├── logger.js       # Logging utility
│       └── diff.js         # Diff rendering
```

---

## License

MIT
