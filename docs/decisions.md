# Architecture Decision Records

Short records of decisions that are expensive to reverse. One entry per decision, newest at the bottom. Anything structural gets an entry.

All ADRs below are **Proposed**: researched and recommended, waiting for Abdelah's review. Each one becomes **Accepted** when he agrees, or is rewritten.

## Template

```markdown
## ADR-000N: Title

- **Date:** YYYY-MM-DD
- **Status:** Proposed | Accepted | Superseded by ADR-000M

### Context
What forced a decision. Constraints, limits, what we knew at the time.

### Decision
What we chose, in one or two sentences.

### Consequences
What this makes easy, what it makes harder, what we now have to live with.

### Alternatives considered
What else was on the table and why it lost.
```

---

## ADR-0001: TypeScript on Node.js LTS

- **Date:** 2026-10-31
- **Status:** Proposed

### Context

Mooring is a CLI plus a long-running supervisor and daemon. It handles TLS, HTTP, the Postgres protocol and filesystem snapshots, on Linux, macOS and Windows/WSL2. The maintainer is one person whose last project (Armband) is TypeScript. The agents we wrap (Claude Code, OpenClaw, OpenCode, Gemini CLI) are mostly TypeScript on Node or Bun, and their users already have Node installed.

Node release status on 2026-10-31 ([schedule](https://raw.githubusercontent.com/nodejs/Release/main/schedule.json)):

| Line | Status | End of life |
| --- | --- | --- |
| **Node 26** | **Active LTS since 2026-10-28** | 2029-04-30 |
| Node 24 | Maintenance LTS | 2028-04-30 |
| Node 22 | Maintenance | 2027-04-30 |

Built-ins we can lean on:

- `node:tls`, `node:http`, `node:http2` and `node:net` for the proxy;
- `node:zlib` with zstd for snapshots;
- `fs.copyFile` with `COPYFILE_FICLONE` (reflink on Linux only; [libuv](https://docs.libuv.org/en/v1.x/fs.html));
- `node:sqlite` (Release candidate, 1.2);
- `node --build-sea` for single-file binaries (added in v25.5; Active development, 1.1).

### Decision

TypeScript in strict mode, in a pnpm monorepo set up like Armband's. **Develop and build on Node 26 LTS. Support `engines: ">=24.12"`**, so users on the still-supported Node 24 line aren't excluded. Publish compiled JavaScript, because Node refuses to type-strip `.ts` files under `node_modules`.

### Consequences

- One language end to end, from CLI to dashboard to docs site. It's familiar, testable with Vitest, and has a huge library ecosystem.
- **No native code in the core** (Mooring drives existing OS sandboxes instead). So there is no node-gyp, no per-platform builds, and npm install just works.
- Performance is fine for a local proxy. Body scanning is linear-time (Aho-Corasick) and bounded by caps.
- If we ever need kernel-level hooks, they go in an optional native helper (ARCHITECTURE §4.4), which needs a separate ADR.
- The dev machine currently has Node 24.8, so it must move to Node 26 before Phase 0.

### Alternatives considered

- **Go or Rust.** These are the languages of the closest competitors: nono is Rust, agentsh and Leash are Go. They give static binaries, easier syscalls (seccomp, Landlock) and no runtime to install. They lost because the maintainer's speed and quality bar are in TypeScript, and the brief fixes the stack. The cost is that two-stage seccomp and Landlock are harder for us (see ADR-0004).
- **Bun.** It has a fast runtime and `bun build --compile` cross-compiles to every OS. It lost as the *runtime* because our daemon would sit on Bun's Node-compatibility layer for `node:tls`, `node:http2` and `node:sqlite` edge cases. That's a risk we don't need. Bun stays an option for the binary build (ADR-0007).

---

## ADR-0002: License, Apache-2.0 with DCO sign-off

- **Date:** 2026-10-31
- **Status:** Proposed

### Context

Mooring will be public at launch and wants contributors, company adoption and (after launch) free code signing from SignPath Foundation. SignPath requires an OSI license with no commercial dual-licensing ([terms](https://signpath.org/terms)).

What comparable projects use:

| Project | License |
| --- | --- |
| OpenClaw | MIT |
| Anthropic sandbox-runtime | Apache-2.0 |
| mockttp | Apache-2.0 |
| StrongDM Leash | Apache-2.0 |
| nono | Apache-2.0 |
| agentsh | Apache-2.0 |
| Codex | Apache-2.0 |

### Decision

**Apache-2.0.** Contributions use the **Developer Certificate of Origin** (`git commit -s`), not a CLA.

### Consequences

- An explicit patent grant with defensive termination. That matters more for security tooling that companies run, and legal teams know it.
- Compatible with every dependency we've picked (MIT, Apache-2.0, ISC, BSD).
- Needs a `LICENSE` file and a `NOTICE` file. It's slightly heavier than MIT: modified files should say so.
- DCO is lighter than a CLA for a solo maintainer, but it does need a DCO check in CI (free GitHub app or action).

### Alternatives considered

- **MIT.** It's simplest and OpenClaw uses it, but it has no patent grant. That was a close second.
- **MPL-2.0.** File-level copyleft would keep improvements to Mooring's own files open, but it puts off some corporate users for little gain.
- **AGPL-3.0.** It protects against a hosted fork, but Mooring is local-only and never hosted, so the network clause buys nothing and scares adopters.

---

## ADR-0003: CLI framework, commander (with @clack/prompts for the wizard)

- **Date:** 2026-10-31
- **Status:** Proposed

### Context

Mooring needs nested subcommands (`mooring daemon install`), pass-through argv (`mooring claude -- --resume`), good help output, and typed options. The `onboard` wizard needs interactive prompts. The candidates as of 2026-10-31 (npm registry):

| Package | Version | Weekly downloads | Dependencies | Notes |
| --- | --- | --- | --- | --- |
| commander | 15.0.0 | 727M | 0 | ESM, Node ≥22.12, typed via `@commander-js/extra-typings` |
| citty | 0.2.2 | 48M | 0 | Typed `defineCommand`, still 0.x |
| clipanion | 4.0.0-rc.4 | — | — | Stuck in RC since 2024-09 |
| yargs | — | — | 6 | — |
| @oclif/core | — | — | 18 | A plugin framework, heavy |

### Decision

**commander** with `@commander-js/extra-typings`. Use **@clack/prompts** (1.8, MIT, 0 heavy dependencies) for `mooring onboard`.

### Consequences

- The most widely used and stable choice, with no dependencies. Pass-through argv after `--` is first-class.
- We write a small typed wrapper so commands are unit-testable without spawning a process.
- If we want a live TUI later, Ink 8 (React) is a separate decision in Phase 5. It isn't needed for prompts.

### Alternatives considered

- **citty.** Lighter and nicer types, but 0.x. If commander's typing feels clumsy in Phase 0, citty is the fallback.
- **clipanion.** Excellent types, but effectively stalled in RC.
- **oclif.** Has a plugin system we don't need; we have our own plugin SDK.
- **yargs.** Heavier, with weaker typings.

---

## ADR-0004: Sandbox strategy per OS

- **Date:** 2026-10-31
- **Status:** Proposed

### Context

The brief asks for OS-level enforcement without native code, working with any agent. The research (THREAT-MODEL §5, ARCHITECTURE §4) found:

- **Linux:**
  - bubblewrap 0.13.x is active, and since 0.12 it is userns-only, with setuid removed.
  - A `--unshare-net` sandbox plus a Unix-socket bridge is exactly what Anthropic's sandbox-runtime and Codex do.
  - **Ubuntu 24.04 blocks unprivileged user namespaces through AppArmor.** We reproduced this on the dev machine: every bwrap namespace fails from a plain terminal, but it works inside VS Code's terminal because of VS Code's AppArmor profile.
  - The fix is the distro's `bwrap-userns-restrict` profile. Ubuntu 25.04+ ships it, and it applies **only to `/usr/bin/bwrap`**.
  - Docker's default seccomp profile blocks bwrap.
  - GitHub's ubuntu-24.04 runners need a `sudo` setup step.
- **macOS:**
  - `sandbox-exec` has been deprecated for years, but it works and Codex, srt and Bazel depend on it.
  - Seatbelt profile language (SBPL) can restrict network to `localhost:PORT`.
  - Endpoint Security and Network Extension need Apple entitlements and a paid account.
- **Windows:**
  - AppContainer can't express "loopback port only".
  - WFP needs admin and a sandbox user.
  - Windows Sandbox needs Pro and a VM.
  - **Microsoft Execution Containers** (GA October 2026, MIT npm SDK) allows proxy-only egress on new builds.
- **Agent hooks** fail open by default and have repeatedly been bypassed (ADR-0011).

### Decision

| Platform | Mechanism | When |
| --- | --- | --- |
| **Linux** | System `/usr/bin/bwrap` with all namespaces unshared, a Node TCP↔UDS bridge, a read-only `$HOME` with masks, and overlays for resolv.conf, hosts, the CA bundle and agent config. **Seccomp** (`AF_UNIX`, `io_uring`, `AF_VSOCK`) is added in Phase 1, by two-stage launch or `pasta --splice-only`, whichever the Phase 1 spike proves. A **preflight** detects the AppArmor restriction and `onboard` offers the profile fix. | Phase 0 |
| **WSL2** | The Linux path, inside the distro, plus interop hardening. | Right after Linux |
| **macOS** | `sandbox-exec` with a generated profile, plus a self-test at launch that a direct external connect fails. | After WSL2 |
| **Native Windows** | **No enforcement and no protection claims.** `install.ps1` installs into WSL2. Native support is evaluated via MXC later. | Later |
| **All** | Agent hooks for approvals and step boundaries. **Advisory only.** | Phases 2 and 4 |

**If any layer can't be built, the agent doesn't start.**

### Consequences

- Strong, explainable guarantees on Linux and WSL2, which is where most agent users with databases and Docker live.
- **A one-time `sudo` step on Ubuntu 24.04.** It's the most common developer distro, so onboarding must make this painless and honest. Docker-in-Docker and default containers are unsupported.
- macOS depends on a deprecated Apple tool. If Apple removes it, the fallback is a VM mode (Apple `container` or Lima) running the Linux path.
- Native Windows users wait. We say so up front.
- We must run agents with their own sandboxes disabled. That's documented per adapter.

### Alternatives considered

- **Containers (Docker or Podman) everywhere.** Leash does this. It's heavy, needs Docker, and moves the agent away from your real machine state. The brief explicitly wants "natively, without Docker".
- **Hooks only.** These are advisory; see ADR-0011.
- **`LD_PRELOAD` or ptrace interception.** Static binaries and Go programs bypass `LD_PRELOAD`. ptrace is slow and fragile.
- **slirp4netns or pasta in full tap mode.** These NAT to any destination, so we'd need a host firewall. Rejected; only `--splice-only` is a candidate.
- **A Landlock-only design like nono's.** Its network rules are port-only, so it can't express "only localhost:P". It also needs direct syscalls, which means native code. Codex has demoted Landlock to legacy. It stays a defence-in-depth candidate for the native helper.

---

## ADR-0005: Proxy, our own core on Node built-ins, with mockttp for tests

- **Date:** 2026-10-31
- **Status:** Proposed. **This needs Abdelah's call: it trades build effort for control.**

### Context

The proxy is the heart of the secret firewall. It must:

- handle CONNECT and decide **before DNS**;
- scan the CONNECT hostname;
- intercept TLS with a CA trusted only in the sandbox;
- choose passthrough or intercept per host;
- scan the URL, headers and decoded body **before** forwarding;
- hold requests for approval;
- **fail closed** on any error.

| Option | Version (2026-10) | License | Interception | HTTP/2 / WS | Body access | Maintenance | Weight |
| --- | --- | --- | --- | --- | --- | --- | --- |
| **mockttp** | 4.6.5 | Apache-2.0 | Yes: CA, per-host passthrough, SNI | Yes / yes | Buffered callbacks; over-cap bodies are dropped to empty | Active | 41 dependencies incl. express and graphql |
| http-mitm-proxy | 1.1.0 (2023) | MIT | Yes (node-forge) | No / yes | Streaming chunks | Effectively unmaintained | Small |
| proxy-chain | 3.0.1 | Apache-2.0 | **No interception** | — | — | Active | — |
| **Own core** on `node:net` / `tls` / `http` + `@peculiar/x509` (3.1, MIT) | — | — | We build it | We build it (HTTP/1.1 first) | Exactly what we need | Ours | Minimal |

### Decision

**Build a small proxy core ourselves**, on Node built-ins, with `@peculiar/x509` for certificate minting (ECDSA P-256, cached per host). Intercepted connections offer **HTTP/1.1 only** through ALPN at first; clients fall back. Bodies are buffered up to a cap and **fully scanned before forwarding**; over the cap, deny unless allowlisted. **mockttp is a dev-dependency** for faking upstream servers in tests.

### Consequences

- We control every fail-closed path, hostname scanning before DNS, re-serialisation (no request smuggling), and the dependency surface. That matters for a security tool.
- **It costs more to build** than wiring up mockttp: maybe a week or two of focused work for CONNECT, TLS, HTTP/1.1, chunked encoding, WebSocket upgrade and bounded buffering, plus tests.
- No HTTP/2 interception at first. Clients that *need* it (Cursor wants bidirectional HTTP/2 streaming; [docs](https://cursor.com/docs/enterprise/network-configuration)) get passthrough or a later HTTP/2 implementation.

### Alternatives considered

- **mockttp as the production proxy.** It's fastest to ship, with HTTP/2, WebSockets and passthrough for free. It lost because its callbacks are mocking-oriented, it silently drops over-cap bodies (we need deny, not empty), and it brings express and graphql into a security tool. **It's a credible plan B** if the own-core spike in Phase 0 drags. The Phase 0 acceptance criteria tell us which way to go.
- **http-mitm-proxy.** Has the streaming hooks we wanted, but is unmaintained and has no HTTP/2.
- **node-forge for certificates.** Slow RSA, and a dual BSD/GPL license. `@peculiar/x509` does it with WebCrypto.

---

## ADR-0006: Website and docs, Astro Starlight on Cloudflare Pages, one URL config value

- **Date:** 2026-10-31
- **Status:** Proposed

### Context

We need a landing page and a full docs site, both free. The repo stays **private until launch**. Research findings:

- **GitHub Pages** needs a public repo on the free plan, and isn't for commercial sites ([plans](https://docs.github.com/en/get-started/learning-about-github/githubs-plans)).
- **Vercel Hobby** is non-commercial only ([fair use](https://vercel.com/docs/limits/fair-use-guidelines)).
- **Netlify** has been credit-based since September 2025: 300 credits a month with a hard stop ([pricing](https://docs.netlify.com/manage/accounts-and-billing/billing/billing-for-credit-based-plans/credit-based-pricing-plans/)).
- **Cloudflare Pages** works with private repos: 500 builds a month, 20,000 files ([limits](https://developers.cloudflare.com/pages/platform/limits/)). Its static bandwidth is generous; re-check the exact terms before launch.

Docs frameworks:

| Framework | Status | Search |
| --- | --- | --- |
| **Starlight 0.42** (Astro) | Very active | Pagefind built in, no service needed |
| VitePress | Stable 1.6.4 is from 2025-08; 2.0 is still alpha | — |
| Docusaurus 3.10 | — | React; local search needs a plugin |

### Decision

- **One Astro project in `site/`** holds both the landing page and the Starlight docs, with Pagefind search.
- It's hosted on **Cloudflare Pages** at `<name>.pages.dev`; the exact subdomain needs checking at signup.
- **The site URL lives in exactly one place, `config/site.json`.** The CLI (update check), the install scripts, the docs config and a CI check that the README links match all read from it.

### Consequences

- Free, with no commercial restriction, and it works while the repo is private (preview deploys for review).
- Starlight is still 0.x, so expect small migrations. The docs content is plain Markdown/MDX and portable.
- Switching to a real domain later is one value plus a DNS record.

### Alternatives considered

- **GitHub Pages.** The simplest once public, but unavailable while private. It's the fallback if we ever leave Cloudflare.
- **Vercel or Netlify subdomains.** The non-commercial clause or credit caps make them weaker long-term homes.
- **VitePress.** Fine, but 2.0 has been in alpha for a long time. **Docusaurus** is heavier.
- **Mintlify and other paid docs platforms.** Not free. OpenClaw itself left Mintlify in 2026-09.

---

## ADR-0007: Release and packaging, npm first, signed checksums, binaries later

- **Date:** 2026-10-31
- **Status:** Proposed

### Context

Every channel must be free. Research findings:

- **Private repo limits:**
  - Release assets need authentication, so `curl | sh` can't work until we're public ([docs](https://docs.github.com/en/repositories/releasing-projects-on-github/about-releases)).
  - npm provenance needs a public repo ([npm](https://docs.npmjs.com/trusted-publishers)).
  - GitHub artifact attestations are free only for public repos.
- **Actions billing:**
  - The free plan includes $12 a month of compute, about 2,000 Linux minutes.
  - macOS costs about 10× Linux and Windows about 1.7× ([billing](https://docs.github.com/en/billing/concepts/product-billing/github-actions)).
  - Standard runners are free for public repos.
- **npm:** classic tokens were revoked in 2025-12. Trusted publishing (OIDC) is the way.
- **Signing:**
  - macOS notarization needs a $99-a-year Apple account.
  - Windows Authenticode certificates cost money.
  - **SignPath Foundation** gives free signing to OSS that meets its requirements, but **excludes "security tools that scan for or exploit vulnerabilities"**, so acceptance is uncertain.
- **Homebrew 6 (2026-06)** requires users to `brew trust` third-party taps. homebrew-core needs at least 225 stars for a self-submission.
- **winget** runs anti-malware and PUA scans. An unsigned exe that installs a CA could fail validation.
- **Single binaries:**
  - `node --build-sea` (Node 26) can cross-build.
  - `bun build --compile` cross-compiles everything but changes the runtime.
  - `pkg` is archived.

### Decision

1. **The npm package is the primary channel.** Its name is pending (CONCEPT §8). It's published from GitHub Actions with **trusted publishing and provenance**, once the repo is public.
2. **`install.sh` / `install.ps1`** check for Node 24.12+, install it if missing (official tarball or `fnm`, decided in Phase 5), then `npm i -g`. On Windows, `install.ps1` installs **into WSL2**.
3. **GitHub Releases** carry `SHA256SUMS`, signed with **cosign keyless** (`sign-blob --bundle`), and an **SBOM** (syft or `pnpm sbom`).
4. **Homebrew tap and Scoop bucket** are our own free repos. **winget** is a later PR, once a signed or proven-clean artifact exists.
5. **Single-file binaries via `node --build-sea`** are evaluated in Phase 5. They're optional, built on Linux, and need ad-hoc re-signing for macOS (`rcodesign`, unverified).
6. **CI budget while private:** Linux for everything. macOS and Windows jobs run only on demand (`workflow_dispatch`).
7. **The update check** fetches a static `latest.json` from the site. It notifies only, never self-updates.

### Consequences

- Most users already have Node, so npm install "just works" with no binary signing problem. Installs via npm, curl and brew avoid Gatekeeper quarantine. Browser downloads need the documented `xattr -d com.apple.quarantine` workaround.
- **Until public:** test from local builds and `npm pack` tarballs. **No curl installer** works while private.
- Unsigned Windows artifacts may trip SmartScreen or antivirus. We apply to SignPath after launch and document the outcome honestly.
- Versioning is **SemVer, starting at 0.x**. 1.0 means the guarantees in THREAT-MODEL §5 are tested on all supported platforms.

### Alternatives considered

- **Binaries first** (like nono or agentsh). That means signing pain on day one, and 3 OSes × 2 architectures to test.
- **Bun-compiled binary.** Easiest cross-compile, but it changes the runtime under the proxy (ADR-0001).
- **release-please or Changesets.** We'll decide in Phase 5. Until then, CHANGELOG.md is written by hand.

---

## ADR-0008: Order of platform support

- **Date:** 2026-10-31
- **Status:** Proposed

### Context

Guarantees differ per OS (THREAT-MODEL §5). The dev machine is Ubuntu 24.04 (ext4, kernel 7.0). WSL2 is the same code path as Linux. macOS needs a different sandbox, and CI minutes for it cost 10× while private. Native Windows has no free, unprivileged, mature option yet.

### Decision

**1. Linux** (Ubuntu 24.04+, Debian 12+, Fedora 40+, Arch) → **2. WSL2** → **3. macOS** (Apple silicon first, Intel best-effort) → **4. native Windows** (MXC, evaluated after 1.0).

The docs carry a per-OS feature table, generated from one data file, so the website and README can't drift.

### Consequences

- Phases 0–4 are built and tested on Linux. macOS work is a contained sub-phase (sandbox profile, `cp -c` snapshots, the keychain question) before launch.
- The launch can honestly say "Linux and WSL2 fully, macOS supported, native Windows planned". Whether macOS is part of the launch is an open decision (PLAN.md).

### Alternatives considered

- **macOS first.** Many agent users are on Macs, but it's a weaker sandbox, 10× CI cost while private, and not the dev's machine.
- **All three at once.** Triples the testing for a solo maintainer.

---

## ADR-0009: Enforcement lives in the session supervisor; the daemon is optional

- **Date:** 2026-10-31
- **Status:** Proposed

### Context

OpenClaw's product shape centres on a daemon (the Gateway). For a safety tool, a central daemon is also a single point of failure: if it crashes or isn't installed, does protection silently stop?

### Decision

Each `mooring <agent>` session runs its own **supervisor**, which owns the sandbox, proxies, scanner, policy, snapshots and recorder. The **daemon** adds convenience:

- dashboard and TUI;
- chat-channel bots;
- a cross-session timeline;
- garbage collection.

**Safety never depends on the daemon.** Without it, approvals use the terminal path (`mooring approve`), and pending remote approvals are denied.

### Consequences

- Phase 0 needs no daemon. The daemon arrives in Phase 5 without reshaping the core.
- Several concurrent sessions each run a proxy, which costs a little memory and is acceptable.
- Chat bots can't run per session, because Telegram allows only one long-poller per bot token. So remote approvals require the daemon.

### Alternatives considered

- **Daemon-centric**, where sessions are thin clients. Less duplication, but the daemon becomes critical and must be installed before anything works. Rejected.

---

## ADR-0010: Snapshots, our own content-addressed store

- **Date:** 2026-10-31
- **Status:** Proposed

### Context

Undo must restore project files exactly, **including untracked and gitignored files (`.env`) and the `.git` directory**. Research findings:

- **Cheap copy-on-write isn't generally available:**
  - **ext4 has no reflink**, and the dev machine is ext4.
  - Node's `COPYFILE_FICLONE` clones only on Linux btrfs or XFS. libuv reverted macOS clonefile, and Windows doesn't clone at all.
- **Shadow-git tools (Cline, Roo Code) can't store `.git` directories** and exclude `.env` and `node_modules`. Roo disables checkpoints when it finds nested repos.
- **Claude Code `/rewind`** doesn't track files changed only by Bash.

### Decision

Our own **content-addressed store**:

- sha256-addressed blobs, zstd-compressed with `node:zlib`;
- one manifest per step (path, mode, size, mtime, hash, symlink target);
- a stat cache so unchanged files aren't re-read.

Restore writes files atomically and deletes files that didn't exist at the target step.

- Regenerable heavy directories (`node_modules/`, `.venv/`, configurable) are **excluded by default but recorded**, with their lockfile hash, and the docs say they aren't undoable.
- Reflink or `cp -c` is a later speed-up, not the design.

### Consequences

- One implementation on every OS, fully under our control, and testable. It handles `.git` and `.env`.
- We own the correctness. It needs heavy property-based tests: snapshot, mutate randomly, restore, then compare byte-for-byte, with modes and symlinks.
- Per-step cost is a stat walk of the project. The Phase 2 acceptance criteria set a performance budget, measured on a large real repo.
- Disk use is bounded by a quota and garbage collection. At the quota Mooring **pauses and asks** rather than continuing without undo.

### Alternatives considered

- **Shadow git.** Mature and cross-platform, but can't hold `.git`, adds a dependency on the git binary's behaviour, and is slow on large untracked trees.
- **OverlayFS upper dir (bwrap `--overlay`).** Cheap session-level undo on ext4, but per-step snapshots of a live upper dir are racy, and it's Linux-only. Worth revisiting as an optimisation.
- **Reflink-only.** Not available on the most common filesystems.

---

## ADR-0011: Agent hooks are UX, not the security boundary

- **Date:** 2026-10-31
- **Status:** Proposed

### Context

Every major agent now has hooks: Claude Code (33 events), Codex, Cursor, Gemini CLI, OpenCode plugins and OpenClaw plugins. They're great for asking a human *inside the agent's own UI* and for marking steps. But:

- Claude Code, Cursor and Gemini **fail open** by default.
- Codex and Gemini have **no "ask"** decision.
- Hooks see command *strings*, not effects.
- A long series of CVEs show agents or repos switching hooks and permissions off: Claude Code CVE-2026-25725, CVE-2026-33068 and CVE-2025-59536; Cursor CVE-2025-54131 and CVE-2026-22708. OpenCode subagents bypassed plugin hooks (#5894).

### Decision

Hooks are used for **approvals in the agent's UI, step boundaries and taint hints**, and never as the only line of defence for anything we call **Enforced**. When we do install hooks, we:

1. put them in the agent's **highest-precedence config tier**, overlaid **only inside the sandbox** (for example Claude Code managed settings, with `allowManagedHooksOnly`);
2. bind every agent config file **read-only** inside the sandbox;
3. turn on fail-closed options where they exist, and make our shim answer *deny* on any internal error;
4. emulate "ask" for agents that lack it, by blocking until the approval resolves (inside each agent's hook timeout).

### Consequences

- The docs tag every command-level protection as **Advisory**. Users know exactly what's soft.
- Each adapter documents its own gaps; for example, "Codex: no ask; we block until approved, max 10 min".
- Hook APIs change often, so adapters need version detection and tests against pinned agent versions.

### Alternatives considered

- **Hooks as the main enforcement** (like melihmucuk/leash or ggshield). Easy to build, but bypassable by design.
- **No hooks at all.** That loses in-agent approvals and precise step boundaries, both of which are big UX wins.
