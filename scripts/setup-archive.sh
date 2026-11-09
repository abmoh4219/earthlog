#!/usr/bin/env bash
# One-time setup of a year's film archive (ADR-0027). Run by Abdelah, once a year (the nightly
# workflow archives into the repository of the current year):
#
#   bash scripts/setup-archive.sh            # this year
#   bash scripts/setup-archive.sh 2027       # a given year
#
# It creates the public repository abmoh4219/earthlog-archive-<year>, publishes it with
# GitHub Pages, and gives the nightly workflow a deploy key that can write to that one
# repository only (stored as the earthlog repository's secret ARCHIVE_DEPLOY_KEY; a new year
# replaces it). The private key is never printed and is deleted from this machine at the end.
# Needs: gh (logged in, with the repo and admin:public_key scopes), git, ssh-keygen.
set -euo pipefail

YEAR="${1:-$(date -u +%Y)}"
OWNER="abmoh4219"
MAIN="earthlog"
REPO="earthlog-archive-$YEAR"

echo "Creating $OWNER/$REPO…"
gh repo create "$OWNER/$REPO" --public \
  --description "Earthlog's archived films ($YEAR): static files played by earthlog-abdi.vercel.app"

# A first commit, so Pages has a branch to publish: no Jekyll, and a page that says what this is.
tmp="$(mktemp -d)"
git -C "$tmp" init -q -b main
touch "$tmp/.nojekyll"
printf '%s\n' '<!doctype html><meta charset="utf-8"><title>Earthlog archive</title><p>Archived Earthlog films. Watch them on <a href="https://earthlog-abdi.vercel.app">Earthlog</a>.</p>' > "$tmp/index.html"
git -C "$tmp" add -A
git -C "$tmp" -c user.name="$(git config user.name)" -c user.email="$(git config user.email)" commit -q -m "chore: start the $YEAR archive"
git -C "$tmp" push -q "https://github.com/$OWNER/$REPO.git" main
rm -rf "$tmp"

echo "Publishing it with GitHub Pages…"
gh api -X POST "repos/$OWNER/$REPO/pages" -f "source[branch]=main" -f "source[path]=/" >/dev/null

echo "Giving the nightly workflow a deploy key for $REPO only…"
keydir="$(mktemp -d)"
ssh-keygen -q -t ed25519 -N "" -C "earthlog nightly archive $YEAR" -f "$keydir/key"
gh repo deploy-key add "$keydir/key.pub" --repo "$OWNER/$REPO" --allow-write --title "earthlog nightly"
gh secret set ARCHIVE_DEPLOY_KEY --repo "$OWNER/$MAIN" < "$keydir/key"
rm -rf "$keydir"

echo "Done. Films older than two weeks will move to https://$OWNER.github.io/$REPO/ every night."
