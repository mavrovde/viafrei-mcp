#!/usr/bin/env bash
# Self-test of approve-release-runs.sh against a stub gh on PATH: it approves
# exactly the held pull_request runs of the branch's head, refuses a branch that
# is not release-please's, and fails (no wait past the deadline) when CI never shows.
set -euo pipefail
here=$(cd "$(dirname "$0")" && pwd)
work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT
mkdir -p "$work/bin"
command cat > "$work/bin/gh" <<'STUB'
#!/usr/bin/env bash
echo "$*" >> "$STUB_LOG"
case "$*" in
  "api repos/o/r/branches/"*) echo "$STUB_SHA" ;;
  "api repos/o/r/actions/runs?"*) [[ ${STUB_NO_CI:-} == 1 ]] && echo '[]' || echo '[{"id":11,"name":"CI","status":"completed","conclusion":"action_required"},{"id":12,"name":"Server","status":"completed","conclusion":"success"}]' ;;
  "api -X POST repos/o/r/actions/runs/"*"/approve") ;;
  *) echo "unexpected gh $*" >&2; exit 9 ;;
esac
STUB
chmod +x "$work/bin/gh"
fails=0
ok() { echo "  PASS  $1"; }
no() { echo "  FAIL  $1"; fails=$((fails + 1)); }
export PATH="$work/bin:$PATH" GH_REPO=o/r STUB_LOG="$work/log" STUB_SHA=$(printf 'a%.0s' {1..40}) APPROVE_POLL_S=0

: > "$work/log"
if "$here/approve-release-runs.sh" release-please--branches--main > "$work/out" 2>&1 \
  && grep -q 'actions/runs/11/approve' "$work/log" && ! grep -q 'actions/runs/12/approve' "$work/log"; then
  ok "the held CI run is approved, a finished one is not"
else no "the held CI run is approved, a finished one is not ($(command cat "$work/out"))"; fi

if "$here/approve-release-runs.sh" feature/x > "$work/out" 2>&1; then no "a branch that is not release-please's is refused"
else [[ $? == 2 ]] && ok "a branch that is not release-please's is refused (exit 2)" || no "refusal exit code"; fi

if STUB_NO_CI=1 APPROVE_WAIT_S=0 "$here/approve-release-runs.sh" release-please--branches--main > "$work/out" 2>&1; then no "no CI run by the deadline fails"
else grep -q 'no pull_request run of CI' "$work/out" && ok "no CI run by the deadline fails, and says how to recover" || no "deadline message ($(command cat "$work/out"))"; fi

echo "approve-release-runs self-test: $fails failed"
[[ $fails == 0 ]]
