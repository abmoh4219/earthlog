<!-- DRAFT README. Everything marked (planned) does not exist yet. Final version: PLAN.md Phase 7. -->

<p align="center">
  <!-- banner (planned): an original sea-otter illustration. Never derived from other projects' art. -->
  <strong>⚓ Mooring</strong>
</p>

<h3 align="center">Recovery-first safety for AI coding agents.</h3>

<p align="center"><em>Your agent can sail anywhere. It can't drift away.</em></p>

<p align="center">
  <!-- badges (planned): CI · npm version · license Apache-2.0 · platforms -->
</p>

> [!WARNING]
> **Pre-alpha. Nothing below works yet.** This README describes where Mooring is going. Every feature is **(planned)** until the [plan](PLAN.md) says otherwise.

Let your agent do anything. Undo everything. Nothing leaves your machine without passing Mooring.

You run `mooring claude` instead of `claude`. Mooring launches the agent (Claude Code, Codex, OpenCode, Gemini CLI, OpenClaw, or any command) inside **OS-level guardrails**. Its network can only go through Mooring, its writes are confined and snapshotted, and its database access goes through a guard. **It doesn't rely on the agent behaving.**

## What it does (planned)

| | |
| --- | --- |
| 🔒 **Secret firewall** | Every outgoing request is scanned for your secrets (`.env`, SSH keys, cloud credentials, CLI tokens) in raw, base64, hex, URL-encoded and split forms. Secrets may go only to the hosts they belong to. After the agent reads untrusted content, the rules tighten. |
| ⏪ **Undo** | A snapshot before every agent step, including gitignored files and `.git`. `mooring undo 3` puts everything back. |
| 🗄️ **Database safety** | A Postgres proxy catches `DROP`, `TRUNCATE`, and `DELETE`/`UPDATE` without `WHERE`. It snapshots first, then asks you. |
| ✋ **Approvals** | Destructive cloud API calls (yes, like *that* Railway `volumeDelete`), force-pushes and more pause and ask in your terminal, the dashboard, or **on your phone** via Telegram, Slack or Discord. |
| 📜 **Flight recorder** | One redacted timeline of commands, file changes, network calls and queries. `mooring replay` walks you through it. |

No LLM calls. No account. No cloud. No telemetry beyond an update check you can turn off.

## Install (planned)

```bash
curl -fsSL https://<site>/install.sh | sh        # Linux · macOS · WSL2
iwr -useb https://<site>/install.ps1 | iex      # Windows (installs into WSL2)
npm install -g <package>                        # if you already manage Node (24.12+)
```

Then run:

```bash
mooring onboard
```

It finds your agents and secret files, checks your platform (including Ubuntu's one-time AppArmor step), and offers shell shortcuts.

## Quick start (planned)

```bash
mooring claude              # Claude Code, moored
mooring codex               # Codex, moored
mooring run -- npm test     # anything, moored

mooring timeline            # what happened, step by step
mooring diff                # what changed
mooring undo 3              # go back three steps
mooring approve <id>        # answer a pending approval
mooring doctor              # check your setup
mooring dashboard           # local UI: timeline, approvals, undo
```

## How it fits together

```
 you ── mooring claude
           │
           ▼
   session supervisor ── secret scanner · taint · policy · approvals · snapshots · recorder
     │        ▲  ▲
     │        │  └── Postgres guard ─────────► your database
     │        └───── HTTP(S) proxy ──────────► the internet (verified TLS)
     ▼
   OS sandbox: the agent and every child process
   no network route except Mooring · writes confined to the project
```

Details: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## What Mooring guarantees, and what it doesn't

We label every protection:

- **Enforced:** holds even if the agent is hostile.
- **Detected:** best-effort inspection; catches mistakes and injected attempts, not a determined attacker.
- **Advisory:** relies on the agent's own hooks.

| | Linux | WSL2 | macOS | Windows (native) |
| --- | --- | --- | --- | --- |
| Network only through Mooring | Enforced | Enforced | Enforced (TCP) | not yet (use WSL2) |
| Secrets blocked in outbound content | Detected | Detected | Detected | — |
| Writes confined to the project | Enforced | Enforced | Enforced | — |
| Per-step undo | Enforced snapshots; step timing is Advisory | same | same | — |
| Destructive SQL held for approval | Enforced route; Detected classification | same | same | — |
| Dangerous commands paused | Advisory | Advisory | Advisory | — |

**Mooring can't stop a determined attacker from encoding a secret in a way no scanner recognises.** What it can stop is that data going anywhere you haven't allowed. The full list of what we don't protect against is in [docs/THREAT-MODEL.md](docs/THREAT-MODEL.md). Please read it before trusting Mooring with anything important.

## Docs

| Topic | Where |
| --- | --- |
| Concept, incidents, positioning | [docs/CONCEPT.md](docs/CONCEPT.md) |
| Architecture | [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) |
| Threat model and guarantees | [docs/THREAT-MODEL.md](docs/THREAT-MODEL.md) |
| Decisions (ADRs) | [docs/decisions.md](docs/decisions.md) |
| Roadmap | [PLAN.md](PLAN.md) |
| Vision | [VISION.md](VISION.md) |
| Full docs site | (planned) |

## Security

Found a way out of the sandbox, or a secret that slips through? See [SECURITY.md](SECURITY.md). Please report privately.

## Development (planned)

```bash
pnpm install
pnpm typecheck && pnpm lint && pnpm test
pnpm test:escape          # the escape suite (Linux, needs bwrap)
```

The rules for contributors, human or AI, are in [CLAUDE.md](CLAUDE.md). Contributions will use DCO sign-off (`git commit -s`).

## Community (planned)

Issues and discussions on GitHub, once the repo is public.

## License

Apache-2.0 (planned; see ADR-0002).
