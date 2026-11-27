#!/usr/bin/env bash
# approve-release-runs.sh BRANCH
#
# The release pull request is opened by github-actions[bot], and GitHub holds
# its pull_request runs (CI, and Server when the server's files changed) as
# "action_required" until they are approved. Branch protection reads only the
# check runs of those pull_request runs, so this script approves them. The
# shape of viafrei-api's script of the same name.
#
# It reads the runs on the branch's head commit (actions/runs?head_sha=...),
# asking again until CI's pull_request run is there: GitHub can take minutes
# to list the runs of a new pull request. It approves every pull_request run
# on that commit that waits for approval, and fails when CI has no run on it
# by the deadline, APPROVE_WAIT_S seconds (default 600) after the start: no
# run is no evidence. A failed read is reported and asked again; the deadline
# still holds. Recovery on a failure: re-run this job once the runs are listed.
set -euo pipefail

branch=${1:?usage: approve-release-runs.sh BRANCH}
[[ $branch == release-please--* ]] || { echo "FAIL: '$branch' is not a release-please branch" >&2; exit 2; }
: "${GH_REPO:?GH_REPO must name the repository}"
deadline=$((SECONDS + ${APPROVE_WAIT_S:-600}))
poll=${APPROVE_POLL_S:-10}
errf=$(mktemp)
trap 'rm -f "$errf"' EXIT
last_err=""

sha=$(gh api "repos/$GH_REPO/branches/$branch" --jq .commit.sha)
[[ $sha =~ ^[0-9a-f]{40}$ ]] || { echo "FAIL: no head commit for $branch" >&2; exit 2; }
echo "release branch $branch at $sha"

while :; do
  if runs=$(gh api "repos/$GH_REPO/actions/runs?head_sha=$sha&event=pull_request&per_page=100" \
    --jq '[.workflow_runs[] | {id, name, status, conclusion}]' 2>"$errf"); then
    last_err=""
    [[ $(jq '[.[] | select(.name == "CI")] | length' <<<"$runs") -gt 0 ]] && break
  else
    last_err=$(tail -n 1 "$errf")
    echo "the runs of $sha could not be read ($last_err); asking again" >&2
  fi
  (( SECONDS < deadline )) || { echo "FAIL: no pull_request run of CI on $sha by the deadline${last_err:+; the last read failed: $last_err}. Re-run this job once GitHub lists it." >&2; exit 1; }
  sleep "$poll"
done
for id in $(jq -r '.[] | select(.conclusion == "action_required") | .id' <<<"$runs"); do
  gh api -X POST "repos/$GH_REPO/actions/runs/$id/approve" >/dev/null
  echo "approved run $id"
done
jq -r '.[] | "\(.name) run \(.id): \(.status) \(.conclusion // "")"' <<<"$runs"
