# Contributing

Thank you — the bridge is deliberately small, which makes it a reasonable place
to send a first patch.

## Read this first: what lives here and what does not

This repository holds the **bridge** — a stdio↔Streamable-HTTP relay to
`https://mcp.viafrei.de/mcp`, published to npm — and, under `server/`, the
**MCP server** itself (draft, being moved in).

The server reads every answer from the public ViaFrei API; it holds no
database. Its tool catalogue is `server/catalogue/catalogue.json`, a copy of
the `catalogue.json` at the root, and it is served byte for byte. It calls no
provider itself: a live DB Timetables board is asked of the API's live
refresher, and read back from the API.

**A change to a data source, or to the data behind an answer, is not made
here:** it is an API change. Open an issue describing what is wrong with the
answer. A change to how the server renders an answer, its transports, or its
tests is a pull request against `server/`.

Things you *can* change here: the relay itself, its argument and configuration
handling, its error messages, its tests, its packaging, the server under
`server/`, and this documentation.

### The server: running and testing it

```sh
cd server
npm ci --ignore-scripts
npm run typecheck
npm test                 # unit tests; the API is mocked (MSW) from its contract's examples
npm run test:e2e:mock    # MCP over Streamable HTTP against Prism mocking the same contract
```

`server/test/fixtures/api-openapi.json` is a byte copy of the API's OpenAPI
contract, pinned by commit, and is never edited here. The operations this
repository proposes to the API live apart, in
`server/test/fixtures/api-proposed.json` (each marked `x-proposed`), merged in by
`scripts/gen-operations.mjs` and `test/api-mock.ts`; the server asks a proposed
operation only once the API's own `/v1/openapi.json` lists it.
`npm run check:operations` fails when the generated operation table is stale. The pre-release job in `publish.yml` runs the same
end-to-end checks against the real API release `server/api.pin` names.

#### Mutation testing: once per release, never per pull request

Coverage shows which lines ran, not whether a test would notice a wrong
answer. StrykerJS (vitest runner,
`server/stryker.config.mjs`) changes one thing at a time in `server/src` (a
negated condition, a moved boundary, an emptied string, ...), runs the tests,
and reports every mutant they do not kill. The scope is every `.ts` file under
`server/src` except the generated operation table.

| Run | When | Fails |
|---|---|---|
| full | once per release: `publish.yml` calls `mutation.yml` on the tagged commit, and the publish job needs it next to Snyk, so a red run stops the publish; or a manual run of `mutation.yml` | below 70 % |

No pull request and no push runs it. Every GitHub job ends within 15 minutes
(`npm run check:timeouts` in CI; the one exception is the mutation shards at 20,
so the whole run ends within the 30 minutes a viafrei-mcp pipeline may take), so the full run is cut into 18 parallel
shards of pieces: a piece is a run of one file's top-level statements, given to
Stryker as a line range, so a large file is spread over several shards; the
pieces are dealt by their measured seconds (`server/scripts/mutation-weights.json`), slowest first to the fastest shard. The **Mutation testing**
job gathers the 18 reports into one score. It fails when a shard did not finish
green, when a piece has no report or two, when a mutant lies outside its
shard's pieces, and below 70 %. The job summary holds the score per file and
every mutant not detected; the reports are the run's artefacts.
`npm run test:mutation-wiring` (in CI) holds the workflows to this and proves
the 8 shards of the real scope disjoint and complete; `npm run
test:mutation-pieces` (in `server/`, in the server workflow) runs Stryker's
instrumenter over the scope whole and shard by shard and proves that no mutant
is lost or counted twice.

A maintainer run, from `server/`:

```sh
npm run mutation                                 # the full run, floor 70 %; report in reports/mutation/
node scripts/mutation.mjs plan 8                 # the 8 shards and their pieces
node scripts/mutation.mjs shard 2/8 mut/shard-2  # one shard, no floor
node scripts/mutation.mjs gather mut out.md      # score the shard directories as one run
```

Stryker mutates the files in place (a test reads the repository's
`catalogue.json` above `server/`), so run shards one after another locally;
if a run is killed hard, `git status` shows the mutant it left behind.

## Running it

Node 22 or newer.

```bash
npm install
npm run build
npm test
```

`npm test` builds first and then runs the suite against a stub server it starts
itself. To try the bridge by hand against that stub, or against any local
Streamable-HTTP MCP server:

```bash
node dist/cli.js --url http://127.0.0.1:3000/mcp
```

More checks exist, and CI runs every one of them (the list of steps is
`.github/workflows/ci.yml`; none of them needs the network):

```bash
npm run check:versions  # package.json and package-lock.json agree on the version
npm run check:tarball   # what npm pack would publish, unpacked and read
npm run test:gate       # poisons that tarball once per rule, and mutates the ruleset once per refusal
npm run check:leaks     # the repository itself (CI adds -- --history for every commit)
npm run test:leaks      # the sweep's own history scope, on a throwaway repository
npm run test:tools      # every spawned program comes from scripts/tools.mjs, not from $PATH
npm run check:docs      # API.md matches catalogue.json
npm run check:readme    # the README's catalogue section matches catalogue.json
npm run check:sources   # the counts SOURCES.md states agree with catalogue.json
```

Each `check:*` above that renders or reads a document has a `test:*` self-test
beside it (`test:docs`, `test:readme`, `test:sources`, `test:versions`), and the
release tooling has more that run against local stubs, injected fetches or
fixture files (`test:probe`, `test:freshness`, `test:release-state` for Version
sync's decisions, the two release verifiers, `test:verify` for npm
and `test:verify-smithery` for the Smithery listing, and `test:release-notes` for
the release page).

### How a release happens

One chain, each workflow one job, each refusal naming its recovery. It is the
shape of viafrei-api's pipeline; where this repository differs, the step says why.

1. **Release pull request** (`.github/workflows/release-please.yml`). After CI
   passes on a push to `main`, release-please opens or updates the pull request
   `chore: release X.Y.Z` from the Conventional Commits since the last release:
   the version in `package.json`, `package-lock.json`, `server/package.json`,
   `server/package-lock.json` and both `catalogue.json` copies
   (`release-please-config.json`), and a `## [X.Y.Z]` block in `CHANGELOG.md`.
   Its `docs` job then regenerates `API.md` and the README catalogue on the
   release branch, because both print the version. Its `approve` job approves the
   pull request's held runs (`scripts/approve-release-runs.sh`). To give the
   release page a lead sentence, add a bold lead to the block in the pull
   request; otherwise the page is titled by the first entry.
2. **Merge.** Merge it with a merge commit once CI is green. Nothing else is
   needed by hand.
3. **Tag.** On that merge's CI success, release-please writes a draft release,
   and the `tag` job checks CI passed on the release commit
   (`scripts/ci-gate.mjs`), pushes the annotated tag `vX.Y.Z` on it, and
   dispatches `publish.yml` **on the tag** with `dry_run=false`. A tag pushed with
   `GITHUB_TOKEN` starts no workflow, so the dispatch is what starts the release;
   it runs on the tag (viafrei-api dispatches on `main`) so npm provenance and the
   image's cosign identity name the tag exactly as a tag push would. Tag only a
   commit whose CI on `main` has completed: every gate below refuses a run still
   going instead of waiting for it.
4. **Release** (`publish.yml`, named `Release`; the file name stays because npm's
   trusted publisher is bound to it). Before anything is packed, on the tagged
   commit: Snyk (`snyk.yml`), the full mutation run (`mutation.yml`, 18 shards,
   70 % floor) and the server e2e against the real API. Then the `npm` job: the
   tag equals the manifest, the versions agree, the commit is on `main`, CI passed
   on it, the build, the offline tests, the sources page, the leak sweep and its
   scope self-test, the publish-hygiene gate's self-test, the pack, the gate on
   that exact tarball, `npm publish --provenance`, and the read-back
   (`scripts/verify-published.mjs`). Then, side by side: `image` dispatches
   `image.yml` on the tag (its own gate, the server tests, Trivy, push by digest,
   cosign, SBOM, verify, then the tags; dispatched rather than called so its
   signing identity stays `image.yml@refs/tags/vX.Y.Z`), and `release-page`
   (`release-page.yml`) fills release-please's draft from the CHANGELOG block
   and publishes it.
5. **Deploy** - outside this repository. It pins the image by digest.
6. **Listings** (`version-sync.yml`, daily at 06:30 UTC, or dispatched right
   after a deploy). It reads the live server's `serverInfo.version`, npm's latest
   and versions, the tags and the last successful run of each listing, and
   `scripts/release-state.mjs` decides. When the live server serves the newest
   tag, it dispatches `mcp-registry.yml` and `smithery.yml` (input `version`) for
   each listing whose last successful run is of another version; both refuse a
   live server of any other version. While the deploy is pending it is green and
   does nothing. The listings never follow npm directly: until 2.7.10 they ran
   straight after npm, always met the older live server, and refused.

A **maintainer's tag push** (`git tag -a vX.Y.Z <sha>`, pushed on its own)
starts step 4 the same way; release-please then finds the tag at its next run.

**Abandoned versions.** A tag npm never served that is older than the newest
tag (2.7.9, after 2.7.10 was cut) is abandoned: it stays a tag (tags are never
moved or deleted), it is never published, and nothing waits on it. Version sync
reports it and judges only the newest tag.

**Recovering a release that stopped.** Each refusal says what to do; in short:

- *CI still running or red on the release commit* (`tag`, `npm` or `image`
  gate): once CI on that commit has finished green, re-run the failed job
  (`gh run rerun <run id> --failed`).
- *Snyk, mutation or e2e red* (nothing packed): an outage is re-run; a real
  finding is fixed on `main`, which makes the next release pull request. The
  stopped tag is then abandoned.
- *npm failed after its checks*: re-run the failed jobs of that Release run, or
  `gh workflow run publish.yml --ref vX.Y.Z -f dry_run=false`.
- *Image or release page failed*: `gh workflow run image.yml --ref vX.Y.Z`, or
  `gh workflow run release-page.yml -f tag=vX.Y.Z`.
- *A listing failed*: dispatch it with `version`, or let the next Version sync
  dispatch it.
- *Version sync red, STUCK*: the newest tag is not on npm; the message names the
  command above.

**Snyk.** `.github/workflows/snyk.yml` runs Snyk Open Source over the npm
dependencies once a week on `main` (Mondays 05:17 UTC; a dispatch on `main`
too) and once per release, called by `publish.yml` on the tagged commit before
anything is packed: `publish` needs it, so a high or critical advisory stops
the release. It never runs on a pull request or a push. In `publish.yml` the
scan runs on a tag only; a `workflow_dispatch` on a branch is the dry-run
rehearsal, which skips the scan and publishes nothing. It needs the Actions
repository secret `SNYK_TOKEN`, handed on by name. `npm run test:snyk` pins
this wiring. An exhausted free-plan monthly test quota fails like an
advisory, and is not forced through.

### Release pages are written from the CHANGELOG

Nobody writes a GitHub release page by hand. After the Release workflow's npm job
has published a `v*` tag and verified it, it calls the `Release page` workflow
(`.github/workflows/release-page.yml`), which fills release-please's draft page for
that tag (or creates the page, for a tag a maintainer pushed) and publishes it:

- **Body:** a normal release note built from the tag's `## [X.Y.Z]` block of
  `CHANGELOG.md`, read at the tag. The retired Version sync proposer's opening paragraph (blocks up to 2.7.10) is
  written for whoever merges the pull request (registry numbers, the probe's verdict,
  the raw list of catalogue differences: tools, prompts or resources added, removed or
  changed, and `initialize` fields moved), so on the page it becomes one sentence:
  "This release mirrors server X.Y.Z." — plus "the tools, prompts and resources are
  unchanged" when the probe said so — and the raw difference list is dropped, whatever
  shape its items take and however they wrap. Everything you wrote below it is kept,
  with hard-wrapped lines joined, because a page renders every newline as a line
  break. A pure mirror gets a line saying no bridge code changed. Every page ends with
  an **Install** section (`npx -y viafrei@X.Y.Z`, left out when the block already
  carries an install line) and a **Full changelog** link to the previous tag. Fenced
  code is kept as written. A missing or empty block fails the run and names the tag,
  and so does a CHANGED or UNCLASSIFIED surface that nobody described, or a leftover
  "A person must ..." instruction: a page cannot say what nobody wrote. **So when the
  surface changed, describe each change in prose for a reader of the package** (what a
  user can now do, what moved), as the v1.7.0 page does.
- **Title:** `viafrei vX.Y.Z — <lead>`, where the lead is the block's **first bold
  lead that is not "Mirrors the server"**. A bold lead is `**...**` opening a
  paragraph or a list item (not a wrapped line that happens to start with bold), with
  backticks and a trailing `.`, `:` or `;` dropped. "Mirrors the server" is the line
  the Version sync proposer opens every block with, so it is skipped and the first
  real change names the page; when it is the block's only bold lead (a pure
  version-sync release) the title is `viafrei vX.Y.Z — same tools, mirrors the server`
  (`MIRROR_TITLE`). The string is one constant, `MIRROR_LEAD` in
  `scripts/release-notes.mjs`, and the self-test fails if a mirror block in
  `CHANGELOG.md` stops matching it. A block release-please wrote has no bold lead
  unless you add one in the release pull request; it is titled by its first entry's
  subject (scope and links dropped). A block with neither fails the run.
- **Latest:** only when the tag is the highest `vX.Y.Z` tag, compared as numbers.
- **Never destructive:** a published page for the tag is left unchanged and the run
  says so; only release-please's draft is filled. To change a page, edit it on GitHub.

`scripts/release-notes.mjs` holds those rules and `npm run test:release-notes` pins
them. To see what a tag's page would say before tagging:

```bash
git tag -l 'v*' > /tmp/tags && echo v1.7.0 >> /tmp/tags
node scripts/release-notes.mjs 1.7.0 CHANGELOG.md /tmp/tags /tmp/body.md && cat /tmp/body.md
```

If a run failed (a block was missing, say), fix nothing on the tag: dispatch the
workflow by hand with the tag once the cause is gone. It verifies npm again first,
and that verifier requires the version to be npm's `latest`, so a dispatch works
for the newest release only.

**API.md and the README's catalogue section are generated.** Do not edit them
by hand: change `catalogue.json` (which a release re-captures from the running
server) and run `npm run docs:api` and `npm run docs:readme`. Everything in the
README outside the two `catalogue:` markers is hand-written and yours to fix.

One more command prints rather than checks, and CI does not run it:

```bash
npm run rules:show      # print the rules both checks read, decoded
```

### The npm the release is published with is pinned

`.github/workflows/publish.yml` sets `NPM_VERSION` and installs exactly that npm,
then asserts it got it. It used to install `npm@latest`, which meant the result
of a release depended on the day it ran: npm 12 changed `npm pack --json` from
an array to an object keyed by package name — a deliberate major-version change
— and the publish job broke with no commit in this repository.

So there is one reader for that output, `scripts/npm-pack-json.mjs`. It knows
both shapes, every caller goes through it, and a shape it does not know is one
sentence naming the npm version, not a stack trace. Its cases are fixtures
rather than whatever npm is installed, because a suite that only packs proves
the pipeline against the npm it happens to be standing next to.

To bump the pin, install the candidate into a temporary prefix instead of
changing your machine's npm, and run the gate against it:

```bash
npm install --prefix /tmp/npm-candidate npm@<version> --ignore-scripts
PATH=/tmp/npm-candidate/node_modules/.bin:$PATH npm run test:gate
```

`scripts/rules.json` is the single list both checks read, and it is worth
knowing why it looks the way it does:

- The private names are stored as **salted sha256 hashes**, never as text. The
  first version of this file listed them in the clear, with a caption explaining
  what each one was, in a public repository — a denylist of secrets is a list of
  secrets. Hashing does not make a short name unguessable; it removes the
  *publication*.
- It was also the one file the sweep skipped, which is precisely where the leak
  ended up. Nothing is skipped now: the rules file holds no secret, so it is
  scanned like any other file.
- The generic patterns (SQL keywords, a source-map marker) are stored base64
  **and reversed**, so the file is not a hit for its own rules when read as text
  *or* when read as base64 — the scanner does both now. `npm run rules:show`
  decodes everything; findings print a hash prefix, a shape or a length, plus a
  file and line, and never the value, because a CI log on a public repository is
  as public as the file.
- **Numbers are not hashed at all.** A hash of a value from a small enumerable
  space is the value with extra steps: that whole space falls in under a tenth
  of a second, and publishing a minimum length made it collapse further. That
  class is covered by the opposite construction — `numbers.allowed`, an
  allow-list of the numbers this repository may contain, with no captions. An
  allow-list tells a reader nothing they could not get by reading the files, and
  it catches every internal value of that shape, not only the ones someone
  remembered to add.
- **Every entry on that allow-list has to occur in the working tree**, and the
  rule is checkable rather than promised: `git grep` each one. An entry that
  occurs nowhere is there to silence a finding about a value somebody took out,
  a diff against the tree isolates it in one step, and an entry a reader can
  isolate is a caption pointing at the value — which is the whole thing the
  allow-list exists to avoid. One entry was like that and has been removed; the
  occurrences it covered are in the history, cannot be recalled, and are
  recorded as residue in `historyNumberResidue`, keyed by blob rather than by
  value.
- **A rule that cannot match anything is a refusal, not a quieter pass.** The
  digit window and the allow-list have to describe the same class of number, so
  moving the window off the allow-list makes both legs exit 2. It used to make
  the number rule inert while both of them printed PASS.
- Counts are not written down in this file on purpose; they drift. `npm run
  rules:show` prints how many of each there are, from the file itself.

Adding a rule: a new pattern needs a `sample` (base64, reversed) that it must
match, and a new forbidden file name needs a `sample` file name that it rejects —
the gate's self-test builds one poisoned tarball per rule from those samples, so
a rule added is a case added, and a rule without a usable sample stops the test
rather than shrinking it. A number does not go on the hash list at all; decide
whether it belongs in a public repository, and if it does, add it to
`numbers.allowed`.

### Adding a private name

**Read this before you add one: the hash does not hide the name.** It keeps the
list out of the clear so that the rules file is not itself the publication, and
it confirms a guess for anyone who already has one. The audit in `rules.json`
recovered *every* entry from a wordlist built out of the platform's own tracked
files — 8 of 8, measured on the eight-entry list of that round. Entries have
been removed since, so read `_read_me` in that file for which list each figure
was measured on rather than carrying one over. So the question to ask is never
"is the hash strong enough" — it is "may this string be confirmed to a
stranger", and two rules answer it:

1. **It must not be a substring of text this repository legitimately prints.**
   Such an entry can never be satisfied; the only ways out are deleting it or
   weakening the scanner, and weakening the scanner is strictly worse. This has
   already happened more than once; `rules.json` records each one, and no count
   of them is kept here, because a count goes stale every time the rule fires.
2. **It must not be anything whose harm *is* the confirmation of a guess** — a
   credential, an API key or token, a password, a session, subscription or
   contract identifier, a certificate serial, a hostname that grants access,
   personal data. A table name confirmed is a fact about a schema a stranger
   cannot reach; an identifier confirmed *is* the identifier. Anything from that
   class does not belong in this repository at all: remove it and rotate it,
   and do not add a hash of it here.

Then: add it as a hash — `node -e "…"` with the salt from the file, or ask a
maintainer — and **never paste the name** into the file, a commit message, an
issue or a pull request. Spell a name of several segments **glued**
(`alphabeta`, not `alpha_beta`): the scanner offers every window of a line both
glued and underscore-joined, so the glued form is found in every separated
spelling *and* inside a run with no boundaries in it, which the separated form
cannot be. Both spellings in that example are inside the declared length range,
so you can try it.

If the name falls outside `minTokenLength`/`maxTokenLength`, **widen** them —
and never narrow them to fit the list. They are the scanner's bounds, not a
description of the entries: the decoders size themselves from the lower one, so
tidying them inwards would cost coverage and sharpen a published range in a
single edit that felt like housekeeping. `blindSpots()` reports what the range
leaves uncovered, on every run.

When an entry has to change, record **the rule that was applied, the lengths,
and any narrowing** in `rules.json` — never what the entry was *about*. Several
such notes together narrow the guess more than the hashes do, which is the
caption failure this whole arrangement exists to have stopped.

**Both checks refuse rather than pass when they cannot see anything.** An empty
repository, a ruleset with no entries, a rule list whose window can no longer
match what it is for, or a history with no blobs: all exit 2, in *each* leg
rather than only in the pair — a leg that refuses because its neighbour does is
not a leg that refuses. A check that read nothing has not checked anything, and
reporting that as success is the failure this project keeps finding.

The self-test asserts that every case it planned actually ran, and refuses when
a rule list it derives cases from is empty. It holds no baseline against an
earlier run, so it does not — and does not claim to — notice a rule list that
merely got shorter.

**What hashing does not do.** The hashes are a confirmation oracle: with a
wordlist anyone could assemble from this repository's own prose, a reviewer
recovered most of them in seconds. That is accepted rather than overlooked. The
list is internal naming with no access value and nothing to rotate, and the real
gain was never the strings; it was losing the captions that explained what each
one *was*, and losing the exemption that stopped the sweep reading its own
rules. `npm run rules:show` prints how many there are; no count and no
breakdown by category is written down here, because a breakdown is a wordlist
hint and a count goes stale the moment the list changes. Moving `rules.json` out
of this repository was considered and rejected: a rules file behind a secret
means the sweep and the gate cannot run for an outside contributor or in a fork,
so the check would report success in exactly the case it exists for.

There is deliberately **no `prepack`, `prepare` or any other lifecycle script**
in `package.json`. npm runs those by itself on every machine that installs the
package, and the gate refuses a published manifest that declares one — including
ours. Build explicitly (`npm run build`) instead.

## Tests are offline. Always.

**No test and no CI job may contact the public endpoint or any provider.** Not
once, not "just to check". Provider keys get revoked for it, and a test that
depends on a live third party fails for reasons that have nothing to do with the
change under review.

The suite runs against a **local stub MCP server that the test starts itself**.
If you are adding a case that needs a server behaviour the stub does not have,
extend the stub.

A test that needs the network is not a test we can merge, however useful it
looks.

## What a good change looks like

- **Fix the cause, not the symptom.** A `catch` that swallows an error so the
  symptom goes away will be sent back.
- **Fail honestly.** A refused or unreachable endpoint should print one line
  naming the URL and the status — never a stack trace, and never a cheerful
  message about something that did not happen. If the bridge does not know, it
  says it does not know.
- **No new dependency without a reason** stated in the pull request. This
  package is installed by `npx` on other people's machines; every dependency is
  someone else's supply chain in your users' terminal.
- **No telemetry, no analytics, no phoning home**, ever. The bridge writes
  nothing outside the OS temp directory.
- **Tests with the change**, in the same pull request.

## The data rules apply to examples too

If you write an example, a fixture or a README snippet that shows a result:

- **MTS-K fuel prices are consumer information only** — and we ask for no
  redistribution in any form, aggregates and comparisons included. Do not build
  an example that shows a price table.
- **DELFI's realtime and disruption feeds are Creative Commons
  Attribution-ShareAlike** — share-alike travels with anything you *derive* from
  them, a rearrangement included. The realtime feeds' catalogue entries state no
  licence version, so do not write one into an example; `SOURCES.md` has the
  evidence.
- Every result carries an attribution line, and an example that drops it teaches
  the wrong thing.

See [NOTICE](NOTICE).

## Pull requests

- One topic per pull request. A refactor bundled with a fix hides the fix.
- Branch from `main`, name it `feat/…`, `fix/…` or `docs/…`.
- Say in the body what you changed, why, and how you know it works — the command
  you ran and the real output, not "tests pass".
- **Every pull request gets an independent review before it is merged.** Expect
  questions; they are about the code.
- Keep the commit history readable. Squash your own noise *before you push*; do
  not rewrite anyone else's. That is about your local commits, and it is not the
  same thing as the button you press at the end — see below.

## Merging: a merge commit, never a squash

**This repository is merged with "Create a merge commit". Rebase and merge is
acceptable. "Squash and merge" is forbidden, and here is why, because a rule
without its reason gets reverted by the next person in a hurry.**

`scripts/rules.json` carries `historyNumberResidue`: a short list of *blobs*,
named by content address, whose number findings the history sweep accepts as
already-published residue. It is keyed by blob because a blob cannot change, so
an exemption cannot quietly widen, and because one entry then covers the same
file at several revisions.

Every one of those blobs lives only in an intermediate commit of a feature
branch. A squash merge writes a single new commit whose tree does not contain
them and leaves no parent that does. Neither reaches them then: not
`git rev-list HEAD` on `main`, which is what the sweep reads by default, and
not `git rev-list --all`, which it reads under `--all-refs` in the
publishing build. `npm run check:leaks -- --history` then reports every entry
as matching no blob in this history — on `main`, for everyone who clones it,
for a condition no contributor introduced. This is not hypothetical: it was
measured in a fresh clone of a squash-merged branch before the rule was written
down.

Three things that look like alternatives and are not:

- *Empty the residue list as part of the squash.* There is no ordering that
  works. Empty it before the merge and the branch's own history leg goes red,
  because on the branch those blobs are still reachable and their findings come
  back. Empty it after and there is a red window on `main` in between. A
  "tolerate a missing blob" setting would close the window, and it would also
  be a bypass switch with better manners.
- *Squash to unpublish the history.* It does not unpublish anything. GitHub
  keeps every pushed tip under `refs/pull/<n>/head`, and those objects stay
  fetchable from the public repository whatever `main` looks like. A squash
  destroys an accurate record of how the code got here and buys nothing in
  exchange.
- *Widen the rule so the failure stops happening.* That is the move this whole
  ruleset exists to refuse. A check that is relaxed until it stops complaining
  is a check that reports success about what it no longer reads.

The cost of the rule, stated plainly rather than glossed: the intermediate
commits stay reachable from `main` for good, including the ones whose content
the residue list exists to excuse. That content is already published — a merge
commit changes *reachability*, not publication, and reachability is the only
thing a sweep can check.

"Allow squash merging" is **off** in Settings → General → Pull Requests, so the
button is not there to click; merge commit and rebase are the only two offered.
A rule that depends on which of three buttons somebody presses would eventually
lose to the default, and a repository setting is not part of any diff, so it
could not be done in the pull request that needed it. If you ever find the
option back on, this section is why it should not be.

## Security

Do not open a public issue, discussion or pull request for a key, a token or a
vulnerability. Use the private path in [SECURITY.md](SECURITY.md). If a secret
of yours is exposed, rotate it first and report it second.

## Licence

By contributing you agree that your contribution is licensed under
[Apache-2.0](LICENSE), like the rest of this code.
