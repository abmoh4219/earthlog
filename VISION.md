# Vision

> Your agent can sail anywhere. It can't drift away.

## Why Mooring exists

Coding agents have become good enough that developers let them run commands, edit files and talk to databases and cloud APIs on their own machines. They're not careful enough, or hard enough to trick, for that to be safe by default. The incidents are real: deleted production databases, wiped home directories, secrets pushed to public repos by a poisoned package that told the agents what to look for ([docs/CONCEPT.md](docs/CONCEPT.md) §1).

The usual answer is to slow the agent down: more prompts, more "are you sure?", narrower permissions. Mooring takes the other side:

**Let the agent move fast, and make the things that matter recoverable or unreachable.**

- What can be undone (your files, your local data) is snapshotted, so mistakes cost seconds.
- What can't be undone (a secret leaving the machine, a production table dropped, a cloud volume deleted) is held at the boundary, until a human says yes.
- Everything is written down, so you always know what happened.

## What we believe

1. **The boundary belongs outside the agent.** Agents can be confused, injected or compromised. Protection that depends on the agent behaving isn't protection. So Mooring uses the operating system and the network.
2. **Recovery beats prevention for the reversible, and prevention is required for the irreversible.** Knowing which is which is the whole product.
3. **Honesty is a security feature.** Every protection says whether it's *Enforced*, *Detected* or *Advisory*. We publish what we don't stop. Tools that overclaim get people hurt, and then get abandoned.
4. **Local-first, forever.** No account, no cloud, no telemetry beyond an update check you can turn off. Your code, secrets and logs never leave your machine because of Mooring.
5. **Works with every agent.** People switch agents monthly; their safety net shouldn't change with them.
6. **Free and open source.** Apache-2.0. Everything in the project runs on free tiers, so anyone can use it, audit it, and fork it.

## What Mooring will be

- One command in front of any agent: `mooring claude`, `mooring codex`, `mooring run -- …`.
- A secret firewall that knows your secrets and their encodings, and gets stricter after your agent reads something untrusted.
- Per-step undo of your project, including the files git ignores.
- A database guard that snapshots before anything destructive and asks first.
- Approvals that reach you on your phone.
- A timeline you can replay.
- A product that installs in one line, onboards you in one wizard, and explains itself with `mooring doctor`.

## What Mooring will never be

- **An AI wrapper.** The core will never call an LLM.
- **A hosted service.** There's no backend to trust, breach or pay for.
- **A container platform.** We complement containers (Leash, Docker Sandboxes) instead of competing with them.
- **A replacement for judgement.** Mooring makes mistakes cheap and theft hard; it doesn't make agent-written code safe to run unmoored.

## Where it goes after 1.0 (planned, not promised)

- Native Windows enforcement through Microsoft Execution Containers.
- More guards: MySQL, Redis, MongoDB, kubectl, Terraform plans, more cloud APIs.
- A community registry for guards and agent adapters, with signed plugins.
- A per-repo "agent passport": a shareable policy that says what agents may do in this project.
- Optional team features that **still run locally**, such as shared policy files in the repo.

## How we'll know it's working

- Developers turn on auto-approve in their agent *because* Mooring is in front of it.
- The first time someone's agent misbehaves under Mooring, they lose seconds, not data, and they tell someone.
- Security people read THREAT-MODEL.md and say "this is honest".
