# opencode-codebase-memory-mcp

[![OpenCode MCP](https://img.shields.io/badge/OpenCode-MCP-blue)](https://opencode.ai/docs/mcp-servers/)
[![Upstream](https://img.shields.io/badge/upstream-DeusData%2Fcodebase-memory--mcp-orange)](https://github.com/DeusData/codebase-memory-mcp)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

**OpenCode installer & fixer** for [DeusData/codebase-memory-mcp](https://github.com/DeusData/codebase-memory-mcp) — local code knowledge graph MCP (14 tools).

Upstream ships its own binary MCP server. This project makes it **reliably discoverable by OpenCode** with correct global paths and config format.

Repository: https://github.com/stevenke1981/opencode-codebase-memory-mcp

---

## Why OpenCode could not find it

| Problem | What happened |
|---------|---------------|
| **Wrong binary path** | `opencode.jsonc` pointed to `C:\Users\eda\.local\bin\...` — another user's machine |
| **Legacy MCP format** | Old `{ "command": "...", "args": [] }` instead of OpenCode's `{ "type": "local", "command": ["..."] }` |
| **Config merge conflict** | Both `opencode.json` and `opencode.jsonc` exist; broken entry in `.jsonc` overrides the good one |
| **Short timeout** | Default 5s MCP timeout; codebase-memory-mcp needs more time on first connect |

This installer fixes all of the above.

---

## For humans — quick start

### Install (global, `~/.config`)

```powershell
powershell -ExecutionPolicy Bypass -File install.ps1
```

Or if you already have the upstream binary:

```powershell
powershell -ExecutionPolicy Bypass -File install.ps1 -UseExisting
```

**macOS / Linux:**

```bash
bash install.sh
# or: bash install.sh --use-existing
```

### What gets installed

| Path | Purpose |
|------|---------|
| `~/.config/opencode-codebase-memory-mcp/bin/` | `codebase-memory-mcp` binary |
| `~/.config/opencode/codebase-memory-mcp.json` | Local settings (timeout, path) |
| `~/.config/opencode/opencode.json(c)` | MCP registration for OpenCode |

### Verify

```bash
node scripts/doctor.mjs
```

Restart OpenCode, then:

```bash
opencode mcp list
opencode run "call list_projects from codebase-memory-mcp"
```

### First use in a repo

Tell OpenCode: **"Index this project"** — or the agent calls `index_repository`.

### Troubleshooting

| Symptom | Fix |
|---------|-----|
| MCP missing in OpenCode | `node scripts/install-global.mjs` then restart |
| Path contains `Users\eda` | Re-run installer (stale config) |
| Timeout on first connect | Increase `timeout` in `codebase-memory-mcp.json` (default 60000) |
| Binary missing | Run installer without `--skip-download` |

### License

MIT (installer). Upstream [codebase-memory-mcp](https://github.com/DeusData/codebase-memory-mcp) is MIT.

---

## For AI agents — operating instructions

<!-- AGENT_README: opencode-codebase-memory-mcp v1.0 -->

You have **codebase-memory-mcp** tools for **structural code intelligence**. Prefer them over grep/glob when finding definitions, call paths, architecture, or relationships.

### When to USE codebase-memory-mcp

| Task | Tool |
|------|------|
| First time in a repo / after big changes | `index_repository` |
| Find functions, classes, routes | `search_graph` |
| Who calls X / what does X call | `trace_path` |
| Read implementation by qualified name | `get_code_snippet` |
| Architecture overview | `get_architecture` |
| Graph schema / counts | `get_graph_schema` |
| Cypher-style queries | `query_graph` |
| Git diff impact | `detect_changes` |
| Text search in indexed files | `search_code` |
| List indexed repos | `list_projects` |

**Session start on unfamiliar codebase:** `list_projects` → `index_repository` (if needed) → `search_graph` / `get_architecture`.

### When NOT to use

| Situation | Use instead |
|-----------|-------------|
| Unindexed repo | `index_repository` first |
| Simple string literal search | `Grep` is OK for literals |
| Non-code files / configs not in graph | `Read` / `Grep` |
| User asks to skip indexing | Respect unless exploration needs structure |

### Install (agents)

One command — do not probe with `ls` first:

```bash
node ~/.config/opencode-codebase-memory-mcp/scripts/install-global.mjs --use-existing
```

If MCP tools are unavailable, run `node scripts/doctor.mjs` and tell the user to restart OpenCode.

### Rules

1. Prefer `search_graph` over blind grep for **definitions** and **relationships**
2. Use `trace_path` before editing widely-called functions
3. Call `index_repository` when `list_projects` shows the repo is missing or stale
4. Do not assume MCP is configured — check tool availability first
5. Pair with [opencode-git-tools](https://github.com/stevenke1981/git-opencode-plugin) for git workflow

### Upstream tools (14)

`index_repository`, `list_projects`, `delete_project`, `index_status`, `search_graph`, `trace_path`, `detect_changes`, `query_graph`, `get_graph_schema`, `get_code_snippet`, `get_architecture`, `search_code`, `manage_adr`, `ingest_traces`

<!-- END_AGENT_README -->

---

## Project layout

```
opencode-codebase-memory-mcp/
├── scripts/
│   ├── install-global.mjs   # download/copy binary + register OpenCode MCP
│   └── doctor.mjs           # diagnose path/config/MCP init
├── mcps/codebase-memory-mcp/tools/  # tool schemas for IDE harness
├── install.ps1 / install.sh
└── config.example.json
```