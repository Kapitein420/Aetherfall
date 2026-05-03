---
name: aetherfall-start
description: Start an Aetherfall work session — sync the local repo with origin, surface anything Codex or the other device pushed, and report the current state so the user knows where to pick up. TRIGGER when Noah says "aetherfall start", "/aetherfall-start", "start aetherfall", "open aetherfall", "let's work on aetherfall", "what's new on aetherfall", "sync aetherfall", "aetherfall status", or otherwise indicates they're beginning a session on the Aetherfall game project. Use this skill whenever the user is about to do work in the Aetherfall repo so they always start from the latest synced state and don't accidentally diverge from the other device.
---

# Aetherfall — Session Start

## Purpose
Noah works on Aetherfall (https://github.com/Kapitein420/Aetherfall.git) from two devices and shares the repo with Codex. Before any work happens, the local checkout needs to match what's on origin so nobody overwrites the other's commits. This skill is the pre-flight check.

## Repo facts
- **Path:** `C:\Automation\Github\Aetherfall`
- **Remote:** `https://github.com/Kapitein420/Aetherfall.git`
- **Default branch:** `main`
- **Co-collaborators:** Noah (two devices), Codex (separate AI editing the same repo)

## What to do when invoked

Run these checks **from the main repo path** (`C:\Automation\Github\Aetherfall`), not from a worktree — the user wants the canonical state, not a scratch branch.

### 1. Sync with origin

Run in parallel:
- `git fetch --all --prune`
- `git status` (to see local state before pulling)

Then decide:
- If on `main` and clean → `git pull --ff-only`
- If on `main` and dirty → **do not pull**. Tell Noah there are uncommitted changes; ask whether to stash, commit, or discard before pulling.
- If on a feature/worktree branch → don't auto-pull main into it. Just report the divergence and let Noah decide.

### 2. Report the state

Give Noah a tight status block. Aim for ~8 lines, not a wall of text:

```
Branch: <current-branch>
Working tree: clean | <N> uncommitted files
vs origin/main: up to date | ahead <N> | behind <N> | diverged

Latest commits:
  <hash> <message>   (× last 5)

New since your last session:
  <commits Noah hasn't seen — based on the pull, if any>
  OR "nothing new from Codex / other device"
```

### 3. Flag handoff signals

Look for things that suggest Codex or the other device left work-in-progress for Noah:
- Recent commits authored by something other than Noah's git identity (e.g. `Codex`, `Claude`, a different email)
- A `CODEX_HANDOFF.md`, `HANDOFF.md`, or similar at repo root or in `docs/`
- A recent commit message containing "WIP", "handoff", "TODO for Noah", "next:"
- Open branches on origin that Noah doesn't have locally (`git branch -r` vs `git branch`)

If any of these show up, surface them — don't bury them in a long log dump.

### 4. Quick repo overview

Only on the FIRST invocation in a session, or if Noah asks "what's in here":
- `README.md` top section (the elevator pitch)
- Top-level dirs and one-line description of each (`src/`, `assets/`, `docs/`, `tools/`, etc.)
- Pointer to `docs/CLAUDE_HANDOFF.md` if it exists — that's the canonical "where we left off" doc

Skip this on follow-up `/aetherfall-start` calls within the same session — Noah already knows.

### 5. Suggest a next move

End with one sentence proposing what to do next, based on what you found. Examples:
- "You're up to date and clean — what do you want to work on?"
- "Codex pushed 3 commits to `main` since yesterday. Want me to summarize what changed?"
- "There's a WIP branch `codex/boss-fight-tweaks` on origin you don't have locally. Pull it down?"
- "You have 2 uncommitted files from your last session — review and commit before I sync?"

Don't propose anything if it's obvious (like "do you want to start working" — yes, obviously, that's why they invoked the skill).

## Why this is shaped this way

The whole point is to prevent the silent-divergence failure: Noah works on device A, forgets to push, switches to device B, edits the same files, now there are two timelines. The skill's job is to make that impossible by always pulling fresh AND surfacing what changed since last time. The "flag handoff signals" step exists because Codex won't always announce what it did — Noah needs to see the trail without asking.

Keep the output short. Noah scans it; he doesn't read it. A wall of `git log` output buries the actual signal.

## Edge cases

- **Repo doesn't exist locally:** offer to `git clone https://github.com/Kapitein420/Aetherfall.git C:\Automation\Github\Aetherfall`. Don't do it without asking — Noah may have intentionally moved it.
- **Merge conflict on pull:** stop, show the conflicting files, ask how to proceed. Never auto-resolve.
- **Detached HEAD:** report it and ask if Noah wants to switch back to `main`.
- **Network failure on fetch:** report it, but still show local status — Noah may want to work offline.
