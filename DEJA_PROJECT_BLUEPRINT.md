# DEJA — Developer Episodic Journal for Agents
### Universal persistent memory for AI coding tools
### Project Blueprint v1.0

> *"Your AI never forgets."*

---

## WHAT IS DEJA

DEJA is an open-source, lightweight, universal memory layer that gives ANY AI coding tool persistent context across sessions. It works with Cursor, Claude Code, Copilot, Windsurf, Codex, and any future AI dev tool — not just one.

When you end a coding session, your AI forgets everything. Next session, you waste 10-15 minutes re-explaining your project architecture, recent changes, and past decisions. DEJA eliminates this by automatically capturing session context and injecting it into your next session, regardless of which AI tool you use.

---

## WHY THIS EXISTS

### The Problem

Every developer using AI coding tools hits this:

1. You spend 45 minutes in Cursor refactoring your auth system
2. Session ends (timeout, crash, you close your laptop)
3. Next session: "Hey, can you continue the auth refactor?" → AI has ZERO memory of what happened
4. You spend 15 minutes re-explaining everything
5. Repeat this 3-5 times per day = 45-75 minutes wasted daily

Multiply by millions of developers. This is the single biggest friction point in AI-assisted development right now.

### What Exists Today (And Why There's Still a Gap)

**claude-mem** (18K+ GitHub stars, Feb 2026)
- Built primarily for Claude Code (Cursor hooks in early development)
- Heavy infrastructure: Chroma vector DB, SQLite, Bun runtime, uv Python manager, worker service on port 37777
- Captures AI tool usage and reasoning (rich but complex)
- Stored in ~/.claude-mem/ (doesn't travel with your repo)
- Context is in a database, not human-readable without the web viewer
- Powerful but heavyweight. Not every dev wants to run a vector database for session memory.

**CLAUDE.md / .cursorrules**
- Manual. You write and maintain these by hand
- No automatic capture of what happened in sessions
- Gets stale the moment you forget to update it

**Other memory MCP plugins (memory-store, memsearch)**
- Tied to specific tool ecosystems
- Most require external databases or cloud services
- None generate context for multiple tools from a single source

### DEJA's Core Insight

**Memory should be a file in your repo, not a service.**

Your project context should live as simple, readable markdown files right next to your code. Any AI tool can read markdown. No vector database. No worker services. No cloud dependency. Just files. And because it's just files, your context travels with your repo. Clone the project on a new machine, your AI already knows the history.

---

## HOW DEJA WORKS

### Architecture: Dead Simple by Design

```
your-project/
├── .deja/
│   ├── config.yml              # Simple config
│   ├── sessions/
│   │   ├── 2026-03-04_14-30.md # Session log (auto-generated)
│   │   ├── 2026-03-04_16-45.md # Another session
│   │   └── 2026-03-05_09-00.md # Today's session
│   ├── context.md              # Auto-compiled context (injected into AI tools)
│   └── knowledge.md            # Long-term learnings (auto-extracted)
├── .cursorrules                # Auto-updated by DEJA for Cursor
├── CLAUDE.md                   # Auto-updated by DEJA for Claude Code
├── .github/copilot-instructions.md  # Auto-updated for Copilot
└── your-code/
```

### The Three Layers

**Layer 1: Session Capture (Automatic)**
DEJA watches your project directory for file changes during coding sessions. It captures:
- Which files were created, modified, deleted
- Git diffs (what actually changed in the code)
- Timestamps of activity
- Branch context

This happens passively via filesystem watching. No hooks into any specific AI tool needed.

**Layer 2: Context Compilation (Automatic)**
After each session (detected by inactivity timeout or explicit `deja stop`), DEJA:
- Takes the raw session log
- Uses a local LLM (ollama) OR an API call (OpenAI/Anthropic) to compress it into a concise summary
- Extracts key decisions, patterns discovered, bugs fixed, architecture changes
- Appends to `context.md` with the latest session summary
- Updates `knowledge.md` with long-term learnings

**Layer 3: Context Injection (Automatic)**
DEJA auto-generates and updates the context file for whichever AI tools you use:
- `.cursorrules` for Cursor
- `CLAUDE.md` for Claude Code
- `.github/copilot-instructions.md` for GitHub Copilot
- `.windsurfrules` for Windsurf
- Any custom format via config

When you start your next session in ANY of these tools, the AI automatically reads the context file and knows:
- What you did in your last 5-10 sessions
- Key architectural decisions you've made
- Active bugs you're tracking
- What branch you were on and what you were working on

### The Key Differentiator: Tool Agnostic

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   Cursor     │     │ Claude Code  │     │   Copilot    │
└──────┬───────┘     └──────┬───────┘     └──────┬───────┘
       │                    │                    │
       │    reads from      │    reads from      │    reads from
       │                    │                    │
       ▼                    ▼                    ▼
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│.cursorrules  │     │  CLAUDE.md   │     │copilot-instr │
└──────┬───────┘     └──────┬───────┘     └──────┬───────┘
       │                    │                    │
       └────────────────────┼────────────────────┘
                            │
                    ┌───────▼───────┐
                    │   .deja/      │
                    │  context.md   │    ← DEJA generates all of them
                    │  sessions/    │       from the same source
                    │  knowledge.md │
                    └───────────────┘
```

You can switch from Cursor to Claude Code to Copilot mid-project and your AI always has the same context. That's the killer feature.

---

## USER EXPERIENCE

### Getting Started (30 seconds)

```bash
# Install
npm install -g deja-dev

# Initialize in any project
cd my-project
deja init

# That's it. DEJA is now watching.
```

`deja init` does:
1. Creates `.deja/` directory
2. Detects which AI tools you use (checks for existing .cursorrules, CLAUDE.md, etc.)
3. Asks for your preferred AI provider for summarization (ollama/openai/anthropic) or defaults to local
4. Starts watching

### Daily Workflow (Zero Friction)

```bash
# Morning: Start your session
deja start
# → "Starting session. Context from your last 3 sessions loaded."

# ... code normally in Cursor/Claude Code/whatever ...
# DEJA silently watches file changes in the background

# End of session (or automatic on inactivity)
deja stop
# → "Session captured. 14 files changed. Context updated."
# → Auto-updates .cursorrules, CLAUDE.md, etc.
```

Or set it to auto-start/stop:

```bash
# In .deja/config.yml
auto_start: true
auto_stop_after: 30m  # 30 minutes of inactivity = session end
```

### CLI Commands

```bash
deja init                    # Initialize DEJA in current project
deja start                   # Start a new session
deja stop                    # End current session and compile context
deja status                  # Show current session stats
deja log                     # Show recent session summaries
deja search "auth refactor"  # Search across all session history
deja context                 # Show what will be injected into AI tools
deja forget <session-id>     # Remove a session from history
deja export                  # Export all context as a single markdown file
deja config                  # Edit configuration
```

### Manual Notes

During a session, you can add manual notes:

```bash
deja note "Decided to use Redis for session storage instead of JWT"
deja note "Bug: the webhook handler fails silently on timeout"
```

These get included in the session log alongside the auto-captured changes.

---

## TECHNICAL IMPLEMENTATION

### Tech Stack

- **Language:** TypeScript (for npm distribution)
- **File watching:** chokidar (mature, cross-platform file watcher)
- **Git integration:** simple-git (for diffs and branch context)
- **AI summarization:** 
  - Primary: Ollama (local, free, private)
  - Fallback: OpenAI API / Anthropic API (cloud, for users without local models)
  - Fallback 2: No AI, just structured raw logs (still useful)
- **Storage:** Plain markdown files (no databases)
- **Distribution:** npm (global install)

### Session Capture Logic

```typescript
// Pseudocode for session capture

class SessionCapture {
  private watcher: FSWatcher;
  private changes: FileChange[] = [];
  
  start() {
    // Watch project directory for changes
    this.watcher = chokidar.watch('.', {
      ignored: ['node_modules', '.git/objects', '.deja', 'dist', 'build'],
      persistent: true
    });
    
    this.watcher.on('change', (path) => {
      this.changes.push({
        type: 'modified',
        path,
        timestamp: Date.now(),
        diff: getDiff(path)  // git diff for this file
      });
    });
    
    this.watcher.on('add', (path) => { /* track new files */ });
    this.watcher.on('unlink', (path) => { /* track deleted files */ });
  }
  
  stop() {
    this.watcher.close();
    
    // Generate session log
    const session = {
      id: generateId(),
      startTime: this.startTime,
      endTime: Date.now(),
      branch: getCurrentBranch(),
      changes: this.changes,
      manualNotes: this.notes,
      summary: null  // filled by AI compression
    };
    
    // Save raw session
    saveSessionLog(session);
    
    // Compress with AI
    session.summary = await compressSession(session);
    
    // Update context files for all detected AI tools
    await updateContextFiles(session);
  }
}
```

### Context Compilation

The context file follows a specific structure designed for AI consumption:

```markdown
# Project Context (Auto-generated by DEJA)
# Last updated: 2026-03-05 09:15:00

## Project Overview
- **Name:** my-saas-app  
- **Stack:** Next.js 15, Supabase, Tailwind, TypeScript
- **Branch:** feature/user-dashboard

## Recent Sessions

### Session: Mar 5, 9:00 AM (current)
- Working on user dashboard component
- Added chart library (recharts) for analytics display

### Session: Mar 4, 4:45 PM
- Refactored auth middleware to support API keys alongside JWT
- Fixed bug: session cookies weren't being set on Safari due to SameSite policy
- Decision: Using Redis for rate limiting instead of in-memory store

### Session: Mar 4, 2:30 PM  
- Set up Stripe integration for subscription billing
- Created webhook handler for payment events
- Known issue: webhook signature verification fails on localhost (ngrok strips headers)

## Active Decisions
- Using Redis for rate limiting (decided Mar 4)
- API keys use prefix-based identification: pk_live_ and pk_test_
- All database queries go through a service layer, never direct from routes

## Known Issues
- Webhook signature verification fails on localhost
- Dashboard charts re-render unnecessarily on tab switch

## Key Patterns
- All API routes follow: validate → authorize → execute → respond
- Error responses use {error: string, code: string} format
- Tests use factory functions for test data, not fixtures
```

### AI Tool Integration

Each AI tool reads context from a different file. DEJA generates all of them from the same `.deja/context.md` source:

```typescript
// Tool adapters
const adapters = {
  cursor: {
    file: '.cursorrules',
    format: (context) => `
# Project Context (managed by DEJA - do not edit manually)
${context}

# Cursor-specific instructions
- Refer to the session history above for recent changes
- Follow the patterns documented in "Key Patterns"
- Check "Known Issues" before suggesting solutions
    `
  },
  
  claudeCode: {
    file: 'CLAUDE.md', 
    format: (context) => `
# CLAUDE.md (managed by DEJA - do not edit manually)
${context}
    `
  },
  
  copilot: {
    file: '.github/copilot-instructions.md',
    format: (context) => `
${context}
    `
  },
  
  windsurf: {
    file: '.windsurfrules',
    format: (context) => `
${context}
    `
  }
};
```

### Configuration

```yaml
# .deja/config.yml

# Which AI tools to generate context files for
tools:
  - cursor
  - claude-code
  - copilot

# How to summarize sessions
ai:
  provider: ollama          # ollama | openai | anthropic | none
  model: llama3.2           # model name for chosen provider
  # api_key: sk-...         # only needed for cloud providers

# Session settings  
session:
  auto_start: true
  auto_stop_after: 30m      # inactivity timeout
  max_sessions_in_context: 5 # how many recent sessions to include

# What to capture
capture:
  file_changes: true
  git_diffs: true
  branch_info: true
  
# Files/directories to ignore (in addition to defaults)
ignore:
  - "*.log"
  - "tmp/"
  - ".env"
```

---

## BUILD PLAN (7 DAYS)

### Day 1-2: Core Engine
- [ ] Project setup (TypeScript, tsconfig, package.json, ESLint)
- [ ] File watcher using chokidar
- [ ] Session start/stop logic
- [ ] Raw session log generation (markdown format)
- [ ] Git integration (current branch, diffs via simple-git)
- [ ] CLI scaffold (commander.js): `deja init`, `deja start`, `deja stop`, `deja status`

### Day 3: AI Compression
- [ ] Ollama integration for local summarization
- [ ] OpenAI/Anthropic API integration as fallback
- [ ] Session compression prompt engineering
- [ ] Knowledge extraction (decisions, patterns, issues)
- [ ] Fallback: structured logs when no AI available

### Day 4: Context Generation
- [ ] Context compilation from session history
- [ ] Tool adapter system (Cursor, Claude Code, Copilot, Windsurf)
- [ ] Auto-detection of which AI tools are in use
- [ ] Auto-update of context files on session stop
- [ ] Config file system (.deja/config.yml)

### Day 5: Polish & Features
- [ ] `deja search` command (grep across session history)
- [ ] `deja log` command (pretty print recent sessions)
- [ ] `deja note` command (manual notes during session)
- [ ] `deja forget` command
- [ ] Inactivity-based auto session stop
- [ ] Proper error handling and edge cases

### Day 6: Distribution & Docs
- [ ] npm package setup and publishing
- [ ] README with GIFs/screenshots
- [ ] Quick start guide
- [ ] GitHub repo setup with proper description, tags, social preview
- [ ] LICENSE (MIT)

### Day 7: Launch
- [ ] Post on Hacker News
- [ ] Post on Reddit (r/programming, r/webdev, r/ChatGPTCoding, r/ClaudeAI, r/cursor)
- [ ] Tweet/X thread with demo video
- [ ] Dev.to article: "I built DEJA because I was tired of re-explaining my codebase to AI"
- [ ] Product Hunt launch

---

## POSITIONING & NARRATIVE

### One-liner
"Universal persistent memory for AI coding tools. Your AI never forgets."

### The Story (for social media, Hacker News, EF application)
"I switch between Cursor, Claude Code, and Copilot across 5 projects. Every time I start a session, I waste 15 minutes re-explaining what I was working on. claude-mem solved this with deep plugin hooks and a vector database. I wanted something simpler. So I built DEJA, a zero-infrastructure memory layer that watches your files, compresses sessions into markdown, and generates context files for every AI tool simultaneously. No Chroma, no SQLite, no worker service. Just markdown files that travel with your repo."

### Why It Wins
1. **Universal from day one** — generates context for every AI coding tool simultaneously, not one at a time
2. **Zero infrastructure** — no databases, no worker services, no extra runtimes. Just Node.js.
3. **Human-readable** — context is markdown files you can read, edit, and commit
4. **Portable** — context travels with your repo. Clone on new machine, AI already knows the history
5. **Private** — everything is local, supports offline-only mode with Ollama
6. **Fast** — no latency added to your coding (watches passively, doesn't hook into tool internals)

### Taglines
- "deja vu for your dev tools"
- "Your AI never forgets"
- "One memory layer. Every AI tool."
- "Stop re-explaining your codebase"

---

## SUCCESS METRICS (First 2 Weeks)

- [ ] npm package published and installable
- [ ] Working with at least Cursor + Claude Code + Copilot
- [ ] 100+ GitHub stars in first 48 hours
- [ ] 500+ npm installs in first week
- [ ] Featured in at least one developer newsletter or blog
- [ ] 3+ community contributions (PRs or issues)

---

## COMPETITIVE ADVANTAGE OVER CLAUDE-MEM

claude-mem (18K+ GitHub stars) is the closest competitor. It's a powerful tool but it's heavy infrastructure. DEJA takes the opposite approach: radical simplicity.

| Feature | claude-mem | DEJA |
|---------|-----------|------|
| Primary tool | Claude Code (Cursor hooks in progress) | All tools equally from day one |
| Architecture | Plugin hooks into specific tool APIs | Tool-agnostic file watcher |
| Dependencies | Chroma vector DB + SQLite + Bun + uv + worker on port 37777 | Node.js only |
| Setup | Multiple plugin commands + auto-installs runtimes | `npm install -g deja-dev && deja init` |
| Storage | SQLite + Chroma (binary, opaque) | Plain markdown files (human-readable) |
| How it captures | Hooks into tool lifecycle (SessionStart, PostToolUse, etc.) | Watches filesystem for file changes + git diffs |
| Context injection | Injects via plugin hooks (tool-specific) | Generates .cursorrules, CLAUDE.md, copilot-instructions.md simultaneously |
| Context is readable | Compressed in database, needs web viewer to inspect | Markdown files you can read, edit, and commit |
| Travels with repo | No (stored in ~/.claude-mem/) | Yes (commit .deja/ to git, whole team gets context) |
| Works offline | Partial (needs API for compression) | Full (with Ollama or even raw logs mode) |
| Adding new tool support | Requires building new hook integrations per tool | Write a 10-line adapter that outputs a text file |

### The Core Difference

claude-mem hooks deep into Claude Code's internals to capture everything the AI does. This gives it rich, detailed data but ties it to one tool's plugin system and requires heavy infrastructure to store and search that data.

DEJA takes the opposite approach: watch the filesystem, capture what changed in the code, compress it into readable markdown, and output it as context files that any AI tool already knows how to read. No hooks, no databases, no worker services. Just files.

The tradeoff: claude-mem captures AI reasoning and tool calls (richer data). DEJA captures code changes and developer notes (simpler, universal). For most developers, knowing what changed in the code is more valuable than knowing what the AI was thinking.

---

## FUTURE ROADMAP (Post-Launch)

### v1.1 — Team Features
- Shared context across team members
- `.deja/` committed to repo = everyone has project memory
- Team knowledge base that grows over time

### v1.2 — IDE Extensions
- VS Code extension (live session indicator in status bar)
- JetBrains plugin
- Neovim plugin

### v1.3 — Smart Features
- Auto-detect when you're stuck on a bug (repeated changes to same file)
- Suggest relevant past sessions when you start working on related code
- Cross-project learning (patterns from project A help in project B)

### v2.0 — DEJA Cloud (Optional)
- Sync context across machines
- Team dashboards
- Analytics on coding patterns
- This is the monetization path

---

*Document Version: 1.0*  
*Created: March 5, 2026*  
*Author: Kartik Sharma*  
*Status: Ready for build*
