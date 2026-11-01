# Security policy

Mooring is a security tool, so a vulnerability in Mooring can put its users at risk. We take reports seriously and handle them in the open once they're fixed.

> **Status: pre-release.** Mooring hasn't shipped yet. This policy takes effect with the first public release. Until then the repository is private, and reports go to the maintainer directly.

## What counts as a vulnerability

Anything that breaks a guarantee in [docs/THREAT-MODEL.md](docs/THREAT-MODEL.md) that is marked **Enforced** is a vulnerability. Examples:

- **Sandbox escape.** A process inside a moored session that reaches the network without going through Mooring's proxy, writes outside the allowed paths, or runs a process outside the sandbox.
- **Secret-firewall bypass using a technique we claim to catch.** A raw or encoded secret that the docs say is blocked but gets through.
- **Approval forgery.** Granting an approval or changing policy from inside the sandbox; replaying or tampering with an approval; an unpaired chat account being able to approve.
- **Mooring leaking a secret itself:** in logs, the timeline, approval messages, crash output or the update check.
- **Exposure of the dashboard or daemon** beyond loopback, auth bypass, CSRF or DNS rebinding.
- **Upstream TLS verification being skipped** in any path.
- **Supply-chain issues** in our releases: unsigned artifacts, checksum mismatches, provenance gaps.

**Not vulnerabilities** (but still welcome as issues):

- Bypasses of protections marked **Detected** or **Advisory** using techniques the threat model already lists as out of reach. Examples: encrypting a secret before sending it; obfuscating a command string past a hook rule. If you find a *cheap, general* bypass of a Detected protection, please report it privately anyway.
- Anything in THREAT-MODEL §7 (out of scope), such as kernel exploits or malware already running as the user.
- Native Windows: there are no enforcement claims there yet.

## How to report

- **After launch:** use **GitHub's private vulnerability reporting** on this repository (Security tab → "Report a vulnerability"). It's free and keeps the report private until it's fixed.
- **Before launch, or if that isn't available:** `<security contact, to be decided before launch>`.

**Please include:**

- the Mooring version, OS and distro, kernel version, and agent and version;
- the exact steps or a script, what you expected, and what happened;
- whether the issue is already public anywhere.

**Please don't:** open a public issue for a vulnerability, test against other people's machines or accounts, or include real secrets in your report.

## What to expect

Mooring is maintained by one person, so these are honest targets, not an SLA:

| Step | Target |
| --- | --- |
| Acknowledge your report | Within 3 days |
| Initial assessment (valid? severity?) | Within 7 days |
| Fix for a critical **Enforced**-guarantee break | As fast as possible, aiming for 14 days |
| Coordinated disclosure | When the fix is released, or 90 days after the report, whichever comes first, unless we agree otherwise |

- We publish a GitHub Security Advisory for each fixed vulnerability, request a CVE when warranted, and credit reporters who want credit.
- **There's no bug bounty.** The project has no budget, and we'd rather say that plainly.

## Supported versions

| Version | Supported |
| --- | --- |
| Latest 0.x minor | ✅ security fixes |
| Older 0.x | ❌ please upgrade |

After 1.0, the latest minor of the current major gets fixes, and this table will be updated.

## Verifying releases (planned)

Every release will ship:

- `SHA256SUMS`, signed with **cosign keyless** (Sigstore);
- an **SBOM**;
- npm packages with **provenance** from GitHub Actions.

Verification commands will be documented here and on the docs site at the first release.

## Safe harbour

We won't pursue legal action against good-faith research that follows this policy: testing only on systems you own, no data destruction beyond your own, no privacy violations, and reporting privately.
