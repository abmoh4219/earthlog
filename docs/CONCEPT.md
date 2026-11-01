# Mooring: concept

> **Recovery-first safety for AI coding agents.**
> Your agent can sail anywhere. It can't drift away.

- **Status:** draft for review. Nothing here is built yet.
- **Last researched:** 2026-10-31. Every external claim links to a source. Anything we could not confirm is marked **unverified**.
- **Related:** [ARCHITECTURE.md](ARCHITECTURE.md) (how it works), [THREAT-MODEL.md](THREAT-MODEL.md) (what it guarantees and what it doesn't), [../PLAN.md](../PLAN.md) (phases), [decisions.md](decisions.md) (ADRs).

---

## 1. The problem

Developers now run coding agents on their own machines with real authority: a shell, their files, their credentials, their databases, their cloud accounts. The agents include Claude Code, Codex, Cursor, Gemini CLI, OpenCode and OpenClaw. Most of the time this is fine. When it isn't, the damage is fast and often irreversible.

### 1.1 Documented incidents

| When | What happened | Source |
| --- | --- | --- |
| Jul 2025 | A Replit agent deleted SaaStr's production database during an explicit code freeze. | [The Register](https://www.theregister.com/2025/07/21/replit_saastr_vibe_coding_incident/) |
| Jul 2025 | A malicious commit shipped in the Amazon Q VS Code extension (v1.84.0) with a prompt telling the agent to wipe the machine and cloud resources (CVE-2025-8217). A formatting flaw made it inert. | [BleepingComputer](https://bleepingcomputer.com/news/security/amazon-ai-coding-agent-hacked-to-inject-data-wiping-commands) |
| Aug 2025 | **Nx "s1ngularity"**: malicious `nx` releases ran Claude Code, Gemini CLI and Amazon Q with permission-skipping flags to hunt for secrets on developer machines. About 2,349 secrets were pushed to public GitHub repos. | [GHSA-cxm3-wv7p-598c](https://github.com/advisories/GHSA-cxm3-wv7p-598c), [Orca](https://orca.security/resources/blog/s1ngularity-supply-chain-attack/) |
| Dec 2025 | Claude Code ran `rm -rf tests/ patches/ plan/ ~/` and wiped a user's macOS home directory. | [GIGAZINE](https://gigazine.net/gsc_news/en/20251216-claude-code-cli-mac-deleted), [similar report](https://claudeissues.com/issue/10077-bug-critical-claude-code-executed-rm-rf-deleting-entire-home-directory) |
| Late 2025 | Google Antigravity, in "Turbo" mode, ran `rmdir /q` on a whole drive while "clearing cache". | [TechRadar](https://www.techradar.com/ai-platforms-assistants/googles-antigravity-ai-deleted-a-developers-drive-and-then-apologized) |
| 2026 | Claude Code ran Terraform without its state file and destroyed DataTalks.Club's production database and snapshots. AWS restored it a day later. | [Tom's Hardware](https://tomshardware.com/tech-industry/artificial-intelligence/claude-code-deletes-developers-production-setup-including-its-database-and-snapshots-2-5-years-of-records-were-nuked-in-an-instant) |
| Apr 2026 | **PocketOS.** Details below. | See below |
| Jan–Feb 2026 | **OpenClaw** exposures. Details below. | See below |

**PocketOS, April 2026.** A Cursor agent running Claude Opus 4.6 was on a routine staging task and hit a credential mismatch. It "fixed" the mismatch by deleting a Railway volume.

- **How.** The agent found a Railway API token "in a file completely unrelated to the task". The token was created for managing custom domains but had blanket authority over Railway's GraphQL API. The agent sent a single `volumeDelete` mutation, with no confirmation step. The founder says it took about 9 seconds ([founder's post](https://x.com/lifeof_jer/status/2048103471019434248), [annotated copy](https://readwise.io/reader/shared/01kqsye7v4p7j0jz3v992fgta8/)).
- **The backups.** Volume-level backups went with the volume. Railway later restored its off-site backups and patched the endpoint to delay deletes ([Decrypt](https://decrypt.co/365897/ai-agent-deletes-startup-database-9-seconds-founder-says), [ABC7](https://abc7.com/post/rogue-ai-agent-cursor-goes-haywire-deletes-tech-companys-database/19008099/)).
- **Correction to our brief:** the data was largely recovered. Accounts differ on how complete the recovery was.
- **What this means for Mooring.** The destructive act was **one HTTPS request** carrying a credential the agent should never have used for that purpose. A network-layer guard sees exactly that request.

**OpenClaw, January–February 2026.**

- **Exposed instances.** Hundreds of OpenClaw Control UIs were found open on the internet, some leaking API keys and chat tokens. The cause was a gateway that trusted "localhost" behind reverse proxies ([Cybersecurity News](https://cybersecuritynews.com/clawdbot-chats-exposed/)). A later scan counted **40,214 exposed instances** ([Infosecurity Magazine](https://www.infosecurity-magazine.com/news/researchers-40000-exposed-openclaw/)).
- **CVE-2026-25475 (CVSS 6.5).** An agent could read any file, including `~/.ssh/id_rsa`, by emitting `MEDIA:/path`, and so send it to the chat channel. Fixed in 2026.1.30 ([OSV](https://osv.dev/vulnerability/CVE-2026-25475), [GitLab advisory](https://advisories.gitlab.com/npm/openclaw/CVE-2026-25475/)). This is separate from the better-known CVE-2026-25253 (gateway token theft leading to RCE).
- **Malicious skills.** Koi Security found **341 malicious skills out of 2,857** on ClawHub, most of them installing an infostealer ([The Hacker News](https://thehackernews.com/2026/02/researchers-find-341-malicious-clawhub.html)).
- **Leaky skills.** Snyk found **283 of 3,984 skills (7.1%)** that expose credentials by design ([Snyk](https://snyk.io/blog/openclaw-skills-credential-leaks-research)).

**The "13 documented cases" write-up** is a [dev.to post by Vericto](https://dev.to/vericto/ai-agents-with-database-access-13-documented-cases-and-the-controls-that-stop-them-1dol) (2026-10-26). It is useful, but Vericto sells a SQL firewall, and several of its "cases" are CVEs or research rather than incidents. We cite the underlying sources, not the list.

### 1.2 The common shape

Every one of these incidents has the same parts:

1. The agent had **more authority than the task needed**: a broad token, production credentials in `.env`, write access to the home directory.
2. The damaging action was **one step**: a command, an HTTP request or a SQL statement.
3. **Nobody was asked**, and there was **no cheap way back**.

Developers feel this as one question: *what is it actually doing on my machine, and can I undo it?*

### 1.3 Why the agents' own guardrails aren't enough

The agents ship real protections, and they are improving fast (§5). They share three limits:

- **They protect one agent each.** Developers use several.
- **Their permission rules are pattern matching on command strings**, and they have been bypassed repeatedly. Claude Code's docs say a deny rule "isn't a security boundary around the program" ([permissions](https://code.claude.com/docs/en/permissions)). Cursor's allowlist was bypassed with backticks and `$(…)` (CVE-2025-54131).
- **Their hooks fail open by default**, and several CVEs let an agent or a repo rewrite the agent's own settings to switch protection off (CVE-2026-25725, CVE-2026-33068 and others; see [THREAT-MODEL.md](THREAT-MODEL.md) §6.7).

The lesson: **put the boundary outside the agent**, in the operating system and on the wire, where it holds even if the agent misbehaves.

---

## 2. Who it's for

| User | Situation | What they want |
| --- | --- | --- |
| **The solo developer** (primary) | Runs Claude Code or Codex daily, often with auto-approve on, on their own laptop | Let the agent run freely without fearing for `~/.ssh`, `.env` or the local database; one-command undo |
| **The startup engineer** | Agents touch staging and sometimes production credentials | A hard stop before destructive SQL or cloud deletions, and an approval on their phone |
| **The OpenClaw / always-on agent user** | An agent runs for hours, driven by chat messages and third-party skills | Untrusted input (skills, web pages, issues) must not turn into exfiltration |
| **The security-minded lead** | Evaluating whether the team may use agents at all | A clear, honest statement of what is enforced, and an audit trail |

**Not for (yet):** fleets, CI-only agents (they already run in disposable containers), or managed enterprise rollouts.

---

## 3. What Mooring is

You run `mooring claude` instead of `claude`. The same works for `mooring codex`, `mooring opencode`, or `mooring run -- <any command>`. Mooring launches the agent **inside an OS sandbox** whose only way out to the network is Mooring's local proxy. It then records, guards and snapshots everything the agent does.

It works with **any** agent, because enforcement doesn't depend on the agent cooperating. Agent-specific adapters add nicer behaviour on top, such as approvals inside the agent's own UI and precise step boundaries.

**Mooring is not an AI wrapper.** The core makes no LLM calls. It is systems engineering: process sandboxing, network proxying and TLS, the Postgres wire protocol, snapshots, taint tracking and a policy engine.

### 3.1 How strong each protection is

Every protection belongs to one of three tiers. The docs, the CLI output and the README always say which tier applies; this is how we stay honest.

| Tier | Meaning | Example |
| --- | --- | --- |
| **Enforced** | Holds even if the agent is hostile and runs arbitrary code, within the stated platform limits | "The agent's processes have no network route except Mooring's proxy" (Linux) |
| **Detected** | Best-effort inspection. Catches mistakes and naive or injected attempts, but not a determined adversary who controls code inside the sandbox | "A request body containing your `.env` value in base64 is blocked" |
| **Advisory** | Relies on the agent's own hook system calling us | "`git push --force` pauses for approval in Claude Code" |

### 3.2 The five pillars

**1. Secret firewall.**

- **Enforced:** the agent has no network path except the proxy. On Linux it runs in its own network namespace with only loopback, so raw sockets, UDP and direct DNS go nowhere.
- **Detected:** every outgoing request is scanned for known secrets. These come from `.env` files, `~/.ssh`, cloud credential files, CLI tokens and (planned) the OS keychain. The scan covers raw, base64 (all three alignments), base64url, hex, URL- and JSON-escaped forms, compressed bodies, and fragments split across requests.
- **Secrets are bound to destinations.** Your Anthropic key may go to `api.anthropic.com` in an auth header, and nowhere else, in nothing else.
- **Taint.** Once the agent has read untrusted content (a web page, an issue, a dependency's README, an MCP result), the session is **tainted** and gets stricter rules. For example, sending a body to a host the session hasn't used before needs approval.
- **TLS interception.** Mooring uses its own local CA, which is trusted **only inside the sandbox**. Nothing is installed in your system trust store unless you explicitly opt in.

**2. Undo.**

- Mooring snapshots the project before every agent step. That includes untracked and gitignored files such as `.env`, and the `.git` directory itself.
- `mooring undo 3` restores the files exactly as they were three steps ago. Undo is itself recorded and can be undone.
- `mooring diff` and `mooring timeline` show what changed and when.
- **Enforced** on Linux: the agent can't write outside the project and a short allowlist of tool directories, so `rm -rf ~` fails instead of needing an undo.

**3. Database safety.** A Postgres wire-protocol proxy sits between the agent and your database.

- It parses SQL with the real Postgres parser (libpg_query, compiled to WASM).
- It catches destructive statements: `DROP`, `TRUNCATE`, `DELETE` or `UPDATE` without `WHERE`, `ALTER … DROP`, and others.
- On a destructive statement it takes a snapshot of what's about to be destroyed, then holds the statement until a human approves.
- **Enforced** for databases routed through Mooring: inside the sandbox there is no other route to them.
- MySQL, Redis and others come later, as plugins.

**4. Approvals and guards.**

- **Dangerous actions pause and ask a human:**
  - destructive SQL;
  - cloud API deletions, such as Railway `volumeDelete` or AWS `DeleteDBInstance`, caught **at the HTTP layer**;
  - `git push --force`;
  - `terraform destroy`.
- **The ask reaches you where you are:** the agent's own prompt (where its hooks allow), `mooring approve` in another terminal, the local dashboard, or your phone via **Telegram, Slack or Discord**.
- **A readable policy file** says what needs approval.
- **Unanswered asks are denied.**

**5. Flight recorder.**

- Commands, file changes, network requests and database queries go onto one timeline per session.
- `mooring replay` walks through what happened, step by step, with diffs. It reconstructs the session; it doesn't re-execute it.
- **Secrets are redacted before anything is written to disk.**

### 3.3 What Mooring does *not* promise

This is a summary; [THREAT-MODEL.md](THREAT-MODEL.md) is the full, binding list.

- **Content scanning can be defeated by a determined adversary** running code inside the sandbox, for example with encryption, steganography, or one byte per request to an allowed host. Against that adversary, the guarantee is **where** traffic can go, not **what** it contains. That is why strict mode allowlists destinations.
- **Secrets the agent puts in its own conversation go to its model provider.** That provider is a destination you already chose to trust.
- **Files the agent writes can run later, outside Mooring.** Examples: `.git/hooks`, `package.json` scripts, `.envrc`, CI workflows. Mooring flags writes to these paths and can undo them, but it can't stop you running them later.
- **Undo covers the project, not the world.** A request that already reached a server can't be unsent. That is why destructive remote actions are *held for approval*, not undone.
- **Platforms differ.** Linux gets the strongest guarantees. macOS relies on Apple's deprecated `sandbox-exec`. Native Windows gets **no enforcement** until a later phase; WSL2 is supported first. The docs show a per-OS table.
- **Kernel exploits, and malware already running as your user outside Mooring,** are out of scope.

> **Note on the one-liner.** The brief's line "It can never leak your secrets or lose your data" is stronger than §3.3 allows, and overclaiming kills security tools. **Proposed instead:** *"Let your agent do anything. Undo everything. Nothing leaves your machine without passing Mooring."* This is a decision for Abdelah; see "Decisions pending" in [PLAN.md](../PLAN.md).

---

## 4. Product shape (influenced by OpenClaw)

OpenClaw ([repo](https://github.com/openclaw/openclaw), about 393k stars, MIT) feels like a finished product rather than a repo. We copy that **shape**, never its assets, text or logo.

| OpenClaw has | Mooring will have | Phase |
| --- | --- | --- |
| One-line install: `install.sh`, `install.ps1`, npm ([docs](https://docs.openclaw.ai/install)) | `curl -fsSL <site>/install.sh \| sh`, `iwr -useb <site>/install.ps1 \| iex`, `npm i -g <package>`. On Windows, `install.ps1` installs into WSL2 until native Windows is supported. | 5 |
| `openclaw onboard --install-daemon` wizard ([docs](https://docs.openclaw.ai/start/wizard)) | `mooring onboard`. Details below. | 5 |
| The Gateway daemon: systemd user unit, LaunchAgent, Scheduled Task | **The Mooring daemon** (we call it the *harbormaster* in prose; the command is plain `mooring daemon`). It is the local control plane for the timeline, snapshots, approvals and policy. **It is never required for safety**; see ADR-0009. | 5 |
| `status`, `doctor`, `dashboard` | `mooring status`, `mooring doctor` (diagnoses the sandbox, AppArmor, CA and agents), `mooring dashboard` (local UI: timeline, approvals, undo), and a TUI | 5 |
| Chat channels, `/approve` | Approval channels: Telegram, Slack, Discord, all outbound-only, on free tiers | 4 |
| Plugins, ClawHub | Plugin SDK for **agent adapters** and **guards** (Postgres, MySQL, Redis, Terraform, AWS, kubectl, Railway…). A community registry comes later. | 4–post-1.0 |
| Telemetry: a version check by default, feature stats opt-in, `telemetry show` ([docs](https://github.com/openclaw/openclaw/blob/main/docs/gateway/telemetry.md)) | **Stricter:** nothing at all except an optional version check that fetches a static `latest.json`. One flag turns it off. The exact request is documented. | 5 |
| README: Install, Quick start, How it fits together, Security, Documentation, Development, Community | The same skeleton, our own words | 6 |
| Docs: Get started, Install, Concepts, Platforms, Gateway & Ops, Reference, Help | Install, Getting started, Concepts, CLI reference, Configuration and policy, Security and threat model, Platforms, FAQ, Troubleshooting | 6 |

**What `mooring onboard` does:**

- detects installed agents;
- finds secret files to protect;
- runs the platform preflight, including the Ubuntu 24.04 AppArmor fix, with your consent;
- offers to put a proxy in front of local Postgres;
- offers shell shortcuts so `claude` runs moored;
- optionally installs the daemon.

**One lesson from OpenClaw we adopt as a hard rule.** The daemon and dashboard bind to **127.0.0.1 only**, need a random token, check the `Host` header against DNS rebinding, and never trust "it came from localhost". OpenClaw's 40,000 exposed instances are what happens otherwise.

---

## 5. Positioning: the honest landscape

The brief named StrongDM Leash as the nearest neighbour. Research found **two closer ones, nono and agentsh**. We must be straight about them.

| Tool | How it enforces | Undo | Leak blocking | DB guard | Phone approvals | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| **Mooring** (planned) | OS sandbox, a proxy and a Postgres proxy; hooks as UX | Per step, includes gitignored files and `.git` | **Content scanning, encoding-aware, with taint** and destination binding | Postgres, snapshot then approve | Telegram, Slack, Discord | TypeScript, npm |
| [**nono**](https://github.com/always-further/nono) | Landlock (Linux), Seatbelt (macOS), WSL2 | Snapshot review and restore | Credential injection ("phantom tokens"), not content scanning | No | Not found | Rust, Apache-2.0, about 4.8k stars, very active; supports OpenClaw. **The closest competitor.** |
| [**agentsh**](https://github.com/canyonroad/agentsh) | seccomp-notify, Landlock, FUSE, eBPF; a shell shim | Checkpoints and `soft_delete` | DLP redaction on an LLM proxy (pattern-based) | **Has a Postgres proxy** (Linux/WSL2); whether it blocks destructive SQL is unverified | Not found (TTY, TOTP, WebAuthn, REST) | Go, Apache-2.0, about 400 stars, active |
| [**StrongDM Leash**](https://github.com/strongdm/leash) | Containers plus a monitoring sidecar, Cedar policies | No | No | No | No | Apache-2.0; no push since 2026-04. We **complement** it; Mooring could run inside its container. |
| **Claude Code `/sandbox`** + [sandbox-runtime](https://github.com/anthropic-experimental/sandbox-runtime) | bubblewrap / Seatbelt with a host proxy (the same pattern we use) | `/rewind` **doesn't track files changed only by Bash** ([docs](https://code.claude.com/docs/en/checkpointing)) | Domain allowlist. Credential **masking** via TLS termination (experimental). The docs warn about exfiltration through broad domains like github.com ([docs](https://code.claude.com/docs/en/sandboxing)) | No | Remote Control and Channels, **Claude only** | Off by default; covers Bash only, not file tools or MCP |
| **Codex CLI** sandbox | bwrap and seccomp (Linux), Seatbelt, Windows MXC/ACL | No | Network on/off and a proxy allowlist | No | No | One agent |
| [**OpenClaw 2.0**](https://docs.openclaw.ai/gateway/secrets/secret-store-and-egress) secrets | Sentinel values swapped in by an egress proxy for bound hosts | Chat "branches" explicitly **don't** undo files | Substitution; **"does not scan outbound traffic for leaked plaintext"** | No | Its own chat channels | OpenClaw only |
| E2B, Docker Sandboxes, Dagger container-use | Cloud VMs, microVMs, containers | Throw away the sandbox | Network policies | No | No | Different model: the agent doesn't run on *your* machine state |
| [GitGuardian ggshield AI hooks](https://docs.gitguardian.com/ggshield-docs/integrations/ai-coding-tools/secret-scanning-for-ai-coding-tools) | Agent hooks | No | Scans prompts and tool calls, **via GitGuardian's cloud API** | No | No | Not local |
| [agent-airlock](https://github.com/sattyamjjain/agent-airlock) | In-process Python tool-call validation | No | No | No | No | A different layer entirely |
| [melihmucuk/leash](https://github.com/melihmucuk/leash) | Agent hooks and plugins: path guard, blocks force-push | No | No | No | No | Advisory only |
| Vericto (commercial) | SQL firewall: MCP, API, TCP proxy | No | No | Yes | Unknown | Paid |

**What only Mooring would do** (as far as we can find; re-check before launch):

1. **Encoding-aware outbound content scanning bound to destinations, plus taint.** Everyone else either allowlists domains or substitutes credentials. Domain allowlists can't stop a leak *to github.com*; content scanning catches the common case of it.
2. **Network-layer guards for cloud APIs.** The PocketOS deletion was one GraphQL request. A Railway guard pauses `volumeDelete`, and an AWS guard pauses `DeleteDBInstance`, for any agent, without the agent's cooperation.
3. **Snapshot-then-approve for destructive SQL**, open source and local.
4. **Cross-agent approvals on your phone** over free chat bots.
5. **Product polish in the npm ecosystem.** The agents are Node and TypeScript; Mooring installs the same way they do.

**What is table stakes, not a differentiator:** undo exists in nono and agentsh, and partially in the agents themselves. We must do it *well*, meaning per step, including `.env` and `.git`, and fast. But we shouldn't lead with "undo exists".

**Stance:** we complement containers (Leash, Docker Sandboxes) and the agents' own sandboxes. Inside Mooring, the agent's own sandbox is switched off, because nested sandboxes fight (see ARCHITECTURE §4.1). Launch copy must not attack named competitors.

---

## 6. Personality

**A sea otter.** Sea otters sleep holding hands, or wrapped in kelp, so they don't drift apart. That is literally mooring.

- **Name proposal: Cleat.** A cleat is the fitting you tie a mooring line to. It's short and friendly, and it isn't taken by a well-known project as far as we found. Alternatives: *Bollard*, *Pip*.
- **Lore seeds:**
  - Cleat keeps a **logbook**; that's the flight recorder.
  - Cleat holds the line while the agent explores.
  - A group of resting otters is a *raft*.
  - Motto: **"Hold fast."**
- **Vocabulary (tasteful, never at the cost of clarity):**
  - Prose may say *moored session*, *logbook*, *harbormaster*, *drift* (an attempted escape).
  - **Commands, flags, errors and security messages use plain English.** `mooring undo`, not `mooring haul-in`. A blocked secret says "Blocked: request to evil.example contains the value of STRIPE_KEY (base64)", with no otter jokes.
- **Art:** our own original drawing. Never derived from OpenClaw's lobster or any existing mascot.
- **Brand risk to check.** Otter.ai is an AI company with an otter logo and has filed a design trademark ([Justia](https://trademark.justia.com/owners/otter-ai-inc-4836830)). Keep the mascot visually distinct (a full sea otter in kelp, not a logo-style head), and never use "Otter" in a product name.

---

## 7. The final product

Where we end up, not where we start.

1. **A website** at a free subdomain (one config value, ADR-0006): what Mooring is, a 60-second demo video, per-OS install commands, and links.
2. **A full docs site** (Astro Starlight with built-in Pagefind search): install, getting started, concepts, CLI reference, configuration and policy, security and threat model, platforms, FAQ, troubleshooting.
3. **Installable on Linux, macOS and Windows (via WSL2 first), amd64 and arm64.**
   - Channels: npm, `install.sh`, `install.ps1`, a Homebrew tap, a Scoop bucket and winget.
   - Releases ship with checksums signed by cosign (keyless), an SBOM, and an update check against a static `latest.json`.
4. **A public GitHub repo** with a README in the OpenClaw style: banner, badges, install, quick start, how it fits together, a guarantees table, a docs table, security, development, community.
5. **A launch on X and Hacker News** with the hero demo:
   - A prompt-injected agent tries to send `~/.ssh/id_rsa` to a server, base64-encoded inside a JSON body. Mooring blocks it live and shows why.
   - The agent then wrecks the repo: `rm -rf src`, `git reset --hard`, a dropped table. `mooring undo` and the database snapshot bring everything back.
   - Optional third beat: a PocketOS-style cloud `volumeDelete` held for approval on a phone.

---

## 8. Naming check (needs a decision)

- **npm:** `mooring` is **taken**, by a dormant hooks library (last publish 2015, last modified 2022, maintainer `apperson-labs`). `mooring-cli` and `getmooring` were free on 2026-10-31. The command can be `mooring` whatever the package is called.
- **Same space:** there is an MCP server called **Mooring** ([seayniclabs/mooring](https://claudemarketplaces.com/mcp/seayniclabs/mooring), PyPI `mooring-mcp`) that gives AI assistants Git and GitHub access. It's a different product, but the same audience.
- **GitHub:** the `mooring` username belongs to an unrelated user from 2012. `mooring-dev`, `getmooring` and `mooringhq` were free.
