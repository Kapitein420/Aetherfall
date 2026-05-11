#!/usr/bin/env node
// Session-end merge-check Stop hook.
//
// Fails loudly when the current branch has commits the already-merged
// PR does NOT include — the "stale merge" failure mode where a PR
// merges mid-session, the branch keeps moving, and the new commits
// land nowhere unless a follow-up PR is opened.
//
// Triggered as a Stop hook from .claude/settings.json. Exits silently
// (code 0) when there's nothing to warn about; exits 2 with a stderr
// message when the stale-merge condition is detected so Claude sees
// the warning and can surface it to the user.

import { execFileSync } from "node:child_process";

// execFileSync (not execSync) so command arguments are passed as an
// argv array, not concatenated through a shell. Branch names like
// `foo & calc` cannot escape into the parent shell — there is no
// parent shell. Closes a Low-severity shell-injection finding.
const run = (cmd, args) => {
  try {
    return execFileSync(cmd, args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
  } catch {
    return "";
  }
};

const branch = run("git", ["rev-parse", "--abbrev-ref", "HEAD"]);
if (!branch || branch === "main" || branch === "HEAD") process.exit(0);

// Fetch latest so we compare against the real origin/main.
run("git", ["fetch", "--quiet", "origin", "main"]);
const ahead = run("git", ["log", "origin/main..HEAD", "--oneline"]).split("\n").filter(Boolean);
if (ahead.length === 0) process.exit(0);

// Look up PRs whose head ref is this branch. Bail silently if gh
// is not authenticated or the repo is not connected to GitHub.
let prs = [];
try {
  const raw = run("gh", ["pr", "list", "--head", branch, "--state", "all", "--json", "number,state,mergedAt,url"]);
  if (raw) prs = JSON.parse(raw);
} catch {
  // gh not available; nothing to compare against, skip.
}
const merged = prs.filter((p) => p.state === "MERGED");
if (merged.length === 0) process.exit(0);

// Stale-merge condition met — print and soft-block.
const prList = merged.map((p) => `  - #${p.number} (${p.url})`).join("\n");
const commitList = ahead.map((l) => `  ${l}`).join("\n");
process.stderr.write(
  `\n⚠️  SESSION-END MERGE CHECK\n` +
  `Branch '${branch}' has ${ahead.length} commit(s) past origin/main, but a PR on this branch is already MERGED:\n` +
  `${prList}\n` +
  `\nThose commits are NOT on main yet. Before closing out the session, open a follow-up PR:\n` +
  `  gh pr create --head ${branch}\n` +
  `or push onto a fresh branch and PR from there.\n\n` +
  `Unmerged commits:\n${commitList}\n\n`,
);
process.exit(2);
