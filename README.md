# DEJA

```
┌────────────────────────────────────────────────────────────────────────┐
│                                                                        │
│  ██████╗ ███████╗     ██╗ █████╗     ███╗   ███╗██╗   ██╗██╗  ██╗      │
│  ██╔══██╗██╔════╝     ██║██╔══██╗    ████╗ ████║██║   ██║╚██╗██╔╝      │
│  ██║  ██║█████╗       ██║███████║    ██╔████╔██║██║   ██║ ╚███╔╝       │
│  ██║  ██║██╔══╝  ██   ██║██╔══██║    ██║╚██╔╝██║██║   ██║ ██╔██╗       │
│  ██████╔╝███████╗╚█████╔╝██║  ██║    ██║ ╚═╝ ██║╚██████╔╝██╔╝ ██╗      │
│  ╚═════╝ ╚══════╝ ╚════╝ ╚═╝  ╚═╝    ╚═╝     ╚═╝ ╚═════╝ ╚═╝  ╚═╝      │
│                                                                        │
│       Multi-agent terminal with supercharged context management        │
│                                                                        │
│                         Your AI never forgets.                         │
│                                                                        │
└────────────────────────────────────────────────────────────────────────┘
```

**Multi-agent terminal with supercharged context management for AI coding tools.**

> Run Claude Code, Copilot, Cursor side-by-side. Share persistent memory across all of them.

---

## Why DEJA?

Every AI coding session starts the same way:

```
You: "Continue the auth refactor from yesterday"
AI: "I don't have context about previous sessions. Can you explain what you're working on?"
```

**DEJA fixes this.** It captures your coding sessions, compresses them into context, and injects that context into every AI tool you use—automatically.

Plus, with **DEJA Mux**, you can run multiple AI agents in split panes with a live dashboard showing exactly what context they're working with.

---

## Installation

```bash
npm install -g deja-dev
```

## Quick Start

```bash
# Initialize in any project
cd my-project
deja init

# Start a coding session
deja start

# ... code with any AI tool ...

# End session (context auto-saved)
deja stop
```

---

## DEJA Mux — Multi-Agent Terminal

Run multiple AI agents in split panes with a live context dashboard:

```bash
# Start the multiplexer
deja mux start

# Attach to session
deja mux attach
```

**Add agent panes:**

```bash
deja mux claude                  # Add Claude Code
deja mux claude ~/backend        # Claude in different dir
deja mux add "cursor ."          # Add Cursor
deja mux add "npm run dev"       # Add dev server
```

**What you get:**

```
┌─────────────────────────────────────────────────────────────────────┐
│ DEJA Dashboard                              ● ACTIVE    14:32       │
│ Session: abc123 │ Duration: 45m │ Files: 12 │ Branch: feature/auth  │
│ [Cursor ✓] [Claude ✓] [Copilot ✓] [Windsurf ✓]                      │
├────────────────────────────────┬────────────────────────────────────┤
│ Claude Code                    │ Claude Code                        │
│ ~/project/backend              │ ~/project/frontend                 │
│                                │                                    │
│ ● Refactoring auth middleware  │ ● Building login component         │
│                                │                                    │
├────────────────────────────────┼────────────────────────────────────┤
│ npm run dev                    │ Live File Changes                  │
│                                │                                    │
│ ✓ Server running on :3000      │ + src/auth/middleware.ts    14:32  │
│ ✓ Watching for changes...      │ ~ src/components/Login.tsx  14:31  │
│                                │ ~ src/api/users.ts          14:28  │
└────────────────────────────────┴────────────────────────────────────┘
```

**Mux commands:**

| Command | Description |
| ------- | ----------- |
| `deja mux start` | Start session with dashboard |
| `deja mux attach` | Attach to running session |
| `deja mux add "cmd"` | Add pane with command |
| `deja mux claude [path]` | Add Claude Code pane |
| `deja mux list` | List all panes |
| `deja mux layout tiled` | Change layout |
| `deja mux kill <n>` | Kill pane by index |
| `deja mux stop` | Stop entire session |

**Keybindings (inside tmux):**

- `Ctrl+b "` — Split horizontally
- `Ctrl+b %` — Split vertically
- `Ctrl+b arrow` — Navigate panes
- `Ctrl+b z` — Zoom/unzoom pane
- `Ctrl+b d` — Detach (session keeps running)

---

## Context Management

DEJA automatically syncs context to all your AI tools:

```
your-project/
├── .deja/
│   ├── sessions/           # Session history
│   ├── context.md          # Compiled context
│   └── knowledge.md        # Long-term learnings
├── .cursorrules            # ← Auto-synced for Cursor
├── CLAUDE.md               # ← Auto-synced for Claude Code
├── .github/
│   └── copilot-instructions.md  # ← Auto-synced for Copilot
└── .windsurfrules          # ← Auto-synced for Windsurf
```

**What gets captured:**

- File changes (adds, modifications, deletions)
- Git diffs and branch info
- Manual notes (`deja note "decided to use Redis"`)
- AI-generated summaries of each session

**What gets injected:**

```markdown
## Recent Sessions

### Mar 5, 2:30 PM
- Refactored auth middleware to support API keys
- Fixed Safari cookie issue (SameSite policy)
- Decision: Using Redis for rate limiting

### Mar 5, 10:00 AM
- Set up Stripe webhooks
- Known issue: signature verification fails on localhost

## Active Decisions
- API keys use prefix: pk_live_, pk_test_
- All routes follow: validate → authorize → execute → respond

## Known Issues
- Webhook signature fails on localhost (ngrok strips headers)
```

---

## All Commands

| Command | Description |
| ------- | ----------- |
| `deja init` | Initialize DEJA in project |
| `deja start` | Start coding session |
| `deja stop` | End session, compile context |
| `deja status` | Show session status |
| `deja log` | Show recent sessions |
| `deja note "..."` | Add manual note |
| `deja search <query>` | Search session history |
| `deja context` | Show current context |
| `deja forget <id>` | Delete a session |
| `deja config` | View/edit config |
| `deja mux ...` | Multi-agent terminal |

---

## AI Providers

DEJA uses AI to summarize sessions. Choose your provider:

| Provider | Setup | Notes |
| -------- | ----- | ----- |
| **Ollama** | `ollama pull llama3.2` | Free, private, offline |
| **OpenAI** | Set `OPENAI_API_KEY` | Fast, cloud |
| **Anthropic** | Set `ANTHROPIC_API_KEY` | High quality |
| **None** | No setup | Basic summaries |

---

## Configuration

Edit `.deja/config.yml`:

```yaml
version: "1.0.0"
aiProvider: "ollama"
autoSync: true

watchPaths:
  - "src/"
  - "lib/"

ignorePaths:
  - "node_modules/"
  - "dist/"

contextFiles:
  cursor: ".cursorrules"
  claude: "CLAUDE.md"
  copilot: ".github/copilot-instructions.md"
  windsurf: ".windsurfrules"
```

---

## Philosophy

**Memory should be a file, not a service.**

- No databases. No cloud. Just markdown files.
- Context travels with your repo (`git clone` = instant memory)
- Human-readable (edit `.deja/context.md` anytime)
- Works offline (with Ollama)
- Tool-agnostic (works with any AI tool that reads context files)

---

## vs Other Solutions

| Feature | DEJA | claude-mem | Manual |
| ------- | ---- | ---------- | ------ |
| Multi-agent terminal | ✅ | ❌ | ❌ |
| Zero infrastructure | ✅ | ❌ | ✅ |
| All AI tools | ✅ | ❌ | ❌ |
| Human-readable | ✅ | ❌ | ✅ |
| Travels with repo | ✅ | ❌ | ✅ |
| Auto capture | ✅ | ✅ | ❌ |

---

## License

MIT

## Contributing

PRs welcome! Open an issue first for major changes.

---

<p align="center">
  <b>Your AI never forgets.</b>
</p>
