# CLAUDE.md: Mooring

Guidance for Claude Code, and any human, working in this repo. Read this before proposing or writing code. These rules are binding; change them only by agreement with Abdelah, in the same commit as the reason.

---

## 1. Purpose

**Mooring is recovery-first safety for AI coding agents.** You run `mooring claude` instead of `claude`. Mooring launches the agent inside OS-level guardrails, so it works with any agent and doesn't rely on the agent behaving.

The five pillars ([docs/CONCEPT.md](docs/CONCEPT.md) §3.2):

1. **Secret firewall.** All agent traffic goes through a local proxy that blocks known secrets in any common encoding, and is stricter after the agent reads untrusted content (taint).
2. **Undo.** Project snapshots at every agent step, including gitignored files and `.git`.
3. **Database safety.** A Postgres wire-protocol proxy holds destructive SQL, snapshots first, and asks a human.
4. **Approvals and guards.** Dangerous actions (destructive cloud API calls, force-pushes) pause and ask in the terminal, the dashboard, or on your phone.
5. **Flight recorder.** One redacted timeline of commands, files, network and SQL.

**Mooring is not an AI wrapper.** The core makes no LLM calls. If a change would add one, stop and ask.

Every protection has a **tier**, and every user-facing claim must state it:

- **Enforced:** holds even against hostile code inside the sandbox.
- **Detected:** best-effort inspection.
- **Advisory:** relies on the agent's hooks.

---

## 2. Architecture summary

Full detail is in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

```
mooring claude
   └─ session supervisor (Node, outside the sandbox)
        ├─ sandbox launcher ──► OS sandbox: agent + all children, NO network route
        │                         └─ bridge 127.0.0.1:P ──► unix socket ──┐
        ├─ HTTP(S) proxy  ◄────────────────────────────────────────────────┘ ──► internet (verified TLS)
        ├─ Postgres guard ◄── bridge ─────────────────────────────────────────► database
        ├─ secret scanner · taint · policy engine · approvals broker (pure where possible)
        ├─ snapshotter (content-addressed store) · recorder (JSONL, redacted)
        └─ control API (request-only; nothing inside can grant)
optional: daemon ── dashboard (127.0.0.1 + token) ── Telegram / Slack / Discord
```

- **Linux and WSL2:** bubblewrap with an isolated network namespace. **macOS:** `sandbox-exec`. **Native Windows:** no enforcement yet (WSL2 instead). See ADR-0004.
- **Enforcement lives in the per-session supervisor. The daemon is never required for safety** (ADR-0009).
- **Agent hooks are UX, not the boundary** (ADR-0011).

---

## 3. Security principles (non-negotiable)

1. **Fail closed.**
   - If the sandbox can't be built, the agent doesn't start.
   - If the proxy errors, the request is denied.
   - If an approval times out or a channel fails, the answer is deny.
   - If the supervisor dies, the sandbox dies.
   - If a SQL statement fails to parse, it is treated as destructive.
   - **No silent fallback to running unprotected, ever.**
2. **Least privilege.**
   - The sandbox gets the project (read-write), a short allowlist of tool dirs, and a read-only view of the rest of `$HOME`, with protected paths masked.
   - Every new mount, env var, socket or exception needs a reason in the PR, and an entry in THREAT-MODEL.md if it weakens a guarantee.
3. **Local-first.**
   - No hosted backend, no account, no cloud processing of user data.
   - The only outbound traffic Mooring itself makes is the optional update check, plus approval channels the user configured.
4. **Never log secrets.**
   - Secret values never reach disk, logs, the timeline, crash output, approval messages or test snapshots.
   - Refer to secrets by name and fingerprint (`STRIPE_KEY from .env, sha256:1a2b…`).
   - A test seeds secrets and greps every output. Keep it passing.
5. **Honest guarantees.**
   - [docs/THREAT-MODEL.md](docs/THREAT-MODEL.md) is the source of truth.
   - The README, docs, website, CLI output and launch posts **may not claim more than it does**.
   - Every Enforced claim has an `ESC-*` test in `test/escape/`, or is marked *(untested)*.
   - When in doubt, under-claim.
6. **Nothing inside can grant.** No API reachable from inside the sandbox may change policy, approve an action, or read Mooring's state, CA key or tokens.
7. **Loopback only.**
   - No Mooring listener ever binds a non-loopback address.
   - The dashboard needs a token and a `Host` check.
   - Never "trust localhost". (OpenClaw had about 40,000 exposed instances; see THREAT-MODEL §6.9.)
8. **Always verify upstream TLS.** There is no flag, env var or config to disable it, including for tests. Tests use a test CA.
9. **Project policy may only tighten.** A `.mooring/policy.yaml` in a repo can add restrictions, never remove the user's.
10. **The update check notifies, it never installs.** Mooring never downloads and runs code.

---

## 4. Platform rules

- **Ubuntu 24.04 blocks unprivileged user namespaces through AppArmor**, so bwrap fails from a plain terminal.
  - **It works inside VS Code's integrated terminal** because VS Code has its own AppArmor profile. **Never treat a test run from an IDE terminal as proof** that a plain terminal works.
  - Test sandbox behaviour via `systemd-run --user --wait --pipe …` or a real terminal.
  - The fix is the distro's `bwrap-userns-restrict` profile, which applies only to **`/usr/bin/bwrap`**. Never vendor or relocate bwrap.
- **Use the system bwrap, and pass `--disable-userns`.** Agents run with **their own sandbox switched off** inside Mooring, because nested sandboxes would undo our mounts.
- **Docker containers with the default seccomp profile can't run bwrap.** That's unsupported; say so, don't work around it silently.
- **macOS relies on the deprecated `sandbox-exec`.** Every launch self-tests that a direct external connection fails.
- **Native Windows: no enforcement, no claims.** Point to WSL2.
- **Feature support per OS lives in one data file** that generates the docs table. Never hand-edit OS support claims elsewhere.

---

## 5. Free-everything budget

Every service, tool and step must be free. If something has no free option, say so, propose the best free alternative, and record the trade-off in an ADR.

| Need | Free choice | Limit / rule |
| --- | --- | --- |
| CI | GitHub Actions | **Private repo: about 2,000 Linux min/month ($12 credit). macOS costs about 10×, Windows about 1.7×.** Build on Linux. macOS and Windows jobs are `workflow_dispatch` only while private. Budget ≤ 1,000 min/month (PLAN.md). Free once public |
| Website and docs | Astro Starlight + Pagefind on Cloudflare Pages | Free subdomain. **The site URL lives only in `config/site.json`** (ADR-0006) |
| Packages | npm, our own Homebrew tap; Scoop and winget later | npm provenance and trusted publishing need the **public** repo |
| Releases | GitHub Releases | **Private-repo release assets need auth**, so the curl installer can't work before launch. Test from local builds |
| Integrity | cosign keyless, syft / `pnpm sbom` | Free |
| Code signing | **None on macOS** (notarization is $99/yr). Windows: apply to SignPath Foundation after launch (acceptance uncertain) | Document the `xattr` workaround |
| Approval channels | Telegram, Slack, Discord bots | Free tiers; outbound-only connections |
| Update check | Static `latest.json` on our site | No backend |
| Dependencies | Open source with compatible licenses (Apache-2.0 project) | No GPL-only or AGPL dependencies in shipped code |

**No paid APIs and no hosted backend in the core**, and no LLM calls.

---

## 6. Folder map (planned)

Nothing exists yet; Phase 0 creates the first of it.

| Path | What lives there |
| --- | --- |
| `packages/mooring/` | The published CLI, supervisor and daemon. Modules are listed in ARCHITECTURE §7 |
| `packages/sdk/` | Plugin SDK: guards, channels, agent adapters (Phase 4) |
| `packages/helper/` | **Reserved** for an optional native helper. Needs an ADR before any code lands |
| `apps/dashboard/` | Local dashboard (Phase 6) |
| `site/` | Website and docs (Phase 7) |
| `scripts/` | `install.sh`, `install.ps1`, release scripts (Phase 6) |
| `test/escape/` | The escape suite: one test per `ESC-*` ID in THREAT-MODEL.md |
| `demo/` | Demo kit: local collector server, injected sample repo |
| `config/site.json` | **The** site URL |
| `docs/` | CONCEPT, ARCHITECTURE, THREAT-MODEL, decisions (ADRs) |

**Pure modules** (`secrets/`, `taint/`, `policy/`) do **no I/O**: no filesystem, network, clock or env. They take data and return verdicts, so the logic that decides what is safe is exhaustively unit-testable.

---

## 7. TypeScript conventions

- **Strict TypeScript.** Every package extends `tsconfig.base.json` with `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes` and `noImplicitOverride`.
- **ESM only. Develop on Node 26 LTS. `engines: ">=24.12"`** (ADR-0001). Publish compiled JS.
- **Zod at every boundary:** config and policy files, hook payloads from agents, control-API requests, daemon IPC messages, chat-platform updates, `latest.json`.
  - No `as` casts on external data.
  - Parse, don't trust.
- **Errors are values at boundaries.** Enforcement code returns explicit verdicts (`allow | deny | ask`) with reasons. Never use a thrown exception as a path to "allow".
- **No `any`.** `unknown` plus narrowing.
- **Child processes:** `spawn`/`execFile` with argument arrays, **never a shell string.** No `exec`, no `shell: true`.
- **Paths:** resolve and normalise before every policy check, and compare real paths (symlinks!). Symlink tricks are a known CVE class in this space.
- **Conventional commits:** `feat:`, `fix:`, `docs:`, `test:`, `refactor:`, `chore:`, `ci:`, `perf:`, `security:`.
- **No new dependency** without saying what it replaces, why the standard library or an existing dependency won't do, its license, its maintenance status and its transitive weight. Security-critical paths (proxy, scanner, sandbox) prefer Node built-ins.
- **Comments explain *why*,** especially every place we deliberately fail closed, mask a path, or accept a residual risk. Link the THREAT-MODEL entry.

---

## 8. Testing rules

- **Vitest** for unit and integration tests.
- **Every bug fix starts with a failing test.** Every new guarantee starts with an `ESC-*` test.
- **Pure modules get ≥ 90% line coverage,** plus property-based tests where an invariant exists (snapshot/restore round-trips, encoding variants).
- **Two corpora matter equally:**
  - the **leak corpus**: everything we claim to block must be blocked;
  - the **false-positive corpus**: normal developer work must not be blocked.
- **Sandbox integration tests run against the real bwrap**, on Linux CI, with a sudo setup step for AppArmor. They're never mocked away.
- **Escape-suite tests try the actual attack** (a real `connect()`, a real `dig`, a real socket open) and assert it fails. They never assert on our own logs.
- **No network in unit tests.** Fake upstreams use mockttp or local servers with a **test CA**.
- **Tests never touch the real `$HOME`, real secrets or the host trust store.** Use temp dirs and generated fake secrets.
- **Before a phase is done:** `pnpm typecheck && pnpm lint && pnpm test` are green, and the escape suite passes on every platform the phase claims.

---

## 9. Release rules

- **SemVer, 0.x until 1.0.** 1.0 means THREAT-MODEL §5 is fully tested on every supported platform.
- **Releases are built only in CI on Linux runners,** never from a laptop.
- **Every release ships `SHA256SUMS`, a cosign keyless signature (bundle) and an SBOM.**
  - npm is published with trusted publishing and provenance once the repo is public.
  - There are no long-lived npm tokens anywhere.
- **CHANGELOG.md is updated in the same PR as the change,** under *Unreleased*.
- **A security fix gets a GitHub Security Advisory and a CVE when warranted.** See SECURITY.md.
- **Before launch** (PLAN.md Phase 7), review every public claim against THREAT-MODEL.md.

---

## 10. Working with Abdelah

- **Abdelah commits and pushes, always.** Never run `git commit`, `git push`, `git tag` or anything that rewrites history. Leave the changes in the working tree and suggest a conventional-commit message.
- **Phase by phase:** plan → build → test → Abdelah reviews and commits → next phase. Never start the next phase uninvited.
- **Explain design decisions before implementing:** the options, the cost of each, and a recommendation. Then wait when the choice is his.
- **Prefer the simplest solution that works.** One person maintains this; clever has to pay for itself.
- **The repo is private until launch.** Treat it as if it were public anyway: no secrets, no personal data, nothing embarrassing in history.
- **The quality bar is Armband:** polished README, ADRs for structural choices, a real test suite. Meet it or beat it.

---

## 11. Rules for Claude

1. **Explain design decisions and trade-offs before implementing.** State the options, the cost of each, and the recommendation, then write the code.
2. **Prefer the simplest solution that works.**
3. **Record anything structural in `docs/decisions.md` as an ADR.**
4. **Never weaken a guarantee quietly.** If a change affects any row of THREAT-MODEL §5, say so up front, and update the threat model in the same change.
5. **Never overclaim.** User-facing text (README, docs, CLI messages) must use the tier words (Enforced, Detected, Advisory) accurately. If you're unsure whether something is enforced, it isn't.
6. **Never add an LLM call, a hosted service, a paid dependency or telemetry.** If one seems necessary, stop and ask.
7. **Never disable TLS verification, the sandbox or fail-closed paths** "temporarily", including in tests. Use test CAs and fixtures.
8. **Research before relying on external behaviour:** agent hook semantics, OS sandbox details, library behaviour. Cite the source in a comment or doc, and mark anything unverified. These ecosystems change monthly.
9. **Test sandbox behaviour outside the IDE terminal** (§4).
10. **Never commit or push.** Finish with a summary and a suggested commit message.
11. **Copy nothing from OpenClaw or other projects:** no assets, text, logo or code. Influence is fine; copying is not. Respect every license.
12. **If a change would raise CI minutes past the budget in §5,** say so with numbers first.
