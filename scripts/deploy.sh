#!/bin/sh
# Builds dist/hornet.html and publishes it to the gh-pages branch, which GitHub Pages serves.
# The site is the page itself at / (index.html) and at /hornet.html.
set -e
cd "$(dirname "$0")/.."
repo=$(pwd)
node scripts/build.mjs
site=$(mktemp -d)
if git fetch -q origin gh-pages 2>/dev/null; then
  git worktree add -q --detach "$site" origin/gh-pages
else
  git worktree add -q --detach "$site" HEAD          # first deploy: start gh-pages with no history of its own
  git -C "$site" checkout -q --orphan gh-pages
fi
cd "$site"
git rm -rqf --ignore-unmatch .
cp "$repo/dist/hornet.html" index.html
cp "$repo/dist/hornet.html" hornet.html
touch .nojekyll
git add -A
if git commit -q -m "Deploy $(git -C "$repo" rev-parse --short HEAD)"; then git push -q origin HEAD:gh-pages && echo "deployed"; else echo "site already up to date"; fi
cd "$repo"
git worktree remove --force "$site"
