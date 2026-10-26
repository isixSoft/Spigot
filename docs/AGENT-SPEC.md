# Spigot agent SPEC

**Status**: draft-for-execution · 2026-10-26  
**Owner**: isixSoft  
**Scope**: work the hourly agent (and humans) may do **before** a full product rewrite.

App build / portable packaging may still be in flight. **This SPEC does not wait on a green release artifact.** Unit and contract tests can land first; UI E2E that needs a built binary is marked `needs-binary`.

Related history (not a queue): root `MODIFICATIONS.md`.

---

## 0. Working rules

1. **Two mainlines only** until both are `done`:
   - **M1 — 打通读写** (Deno push service read + write end-to-end)
   - **M2 — GitHub 可抓取节点测试** (nodes whose share URIs / lists are obtainable from GitHub)
2. One PR (or one coherent commit series) should advance **one** checklist item, not both mainlines mixed without note.
3. Prefer **tests and pure functions** in `src/services/deno-push.ts` (+ `*.test.ts`). Avoid upstream file churn.
4. **Secrets**: never commit `PUSH_KEY`, real deploy URLs with keys, or private subscription tokens. Tests use fixtures / env / `.env.example` names only.
5. Logs: any agent run appends a short entry under `docs/agent-log/` (`YYYY-MM-DD.md`) with: item id, pass/fail, commands, next blocked reason.
6. Do **not** open GitHub Releases from the agent unless the owner explicitly asks.

---

## M1 — 打通读写 (Deno bidirectional)

### Goal

Prove and lock the **write path** (client → Deno `/push`) and the **read path** (Deno → client: pool + switch), so “双向都通” is measurable without relying on manual guesswork.

### Current code map (main)

| Direction | Client | Server (nodes-sub / Deno Deploy — out of this repo) |
|-----------|--------|------------------------------------------------------|
| Write | `pushRows` / `pushToDeno` → `POST pushUrl` + key | `/push` |
| Read pool | `fetchRemotePool` → `GET` same origin as push | `GET /push` (or documented pool URL) |
| Read switch | `setServiceState` / switch UI → `switchUrlOf(pushUrl)` | `/switch` |

Pure helpers already unit-tested: `pickForPush`, `switchUrlOf`, `nameOfUri`, GeoIP, `toShareUri`, etc. **Missing: contract tests against a real or mocked HTTP boundary for both directions.**

### Acceptance

#### M1.1 Write path (client → server)

- [ ] Given a **mock** HTTP server (or recorded fixture) that accepts `POST` with the project’s auth header/body shape, `pushRows` sends the expected payload and treats 2xx as success.
- [ ] Non-2xx and network failure surface a **structured** error (no silent empty success).
- [ ] `minKeep` / empty selection: client **refuses** to push when below threshold (existing product rule); test locks that behaviour.
- [ ] Optional `needs-live`: with `DENO_PUSH_URL` + `DENO_PUSH_KEY` in env (not in git), one live POST of **fixture URIs** succeeds and is documented in agent-log only as pass/fail (no key echo).

#### M1.2 Read path (server → client)

- [ ] `fetchRemotePool` parses a fixture body that matches the server’s list format (including `#OFF# ` disabled prefix if still in protocol).
- [ ] Round-trip invariant test: **push fixture set → fetch pool → names/URIs contain the pushed set** (mock server implementing both POST and GET).
- [ ] `switchUrlOf` already unit-tested; add one integration-level test that the switch request URL and method match the agreed API (mock).
- [ ] Optional `needs-live`: GET pool and toggle switch against env endpoint; log pass/fail only.

#### M1.3 Definition of done for M1

- All **non-`needs-live`** boxes checked.
- `pnpm test` (or project’s vitest invocation in CI) green on the new tests.
- Short section in agent-log: “M1 contract tests landed”.
- Live checks remain optional until owner provides env and a reachable Deno deployment.

### Out of scope for M1

- Redesigning GeoIP or scan UI.
- Changing Clash upstream merge behaviour.
- Auto-updater / signing.

---

## M2 — GitHub 可抓取节点测试

### Goal

Automated tests for **nodes (or node lists) that can be fetched from GitHub** — i.e. content addressable via `raw.githubusercontent.com`, `gist.githubusercontent.com`, or a **pinned release asset URL** — so parsing and pipeline behaviour does not depend on a running Clash core.

### Interpretation (locked unless owner amends)

| In scope | Out of scope |
|----------|----------------|
| Share-URI lines and base64 subscription **fixtures** stored in-repo under `src/services/fixtures/github-nodes/` | Scraping arbitrary HTML repo pages |
| Optional test that **HTTP GET** to a **documented, stable, public** raw/gist URL still returns 200 and parseable lines (mark `network` / skip in offline CI) | Committing secrets or private gist tokens |
| Feeding those URIs through `nameOfUri`, `toShareUri` inverse checks where applicable, and `pickForPush` with synthetic delay/cc | Claiming the nodes are “good” or US without fixture metadata |

GeoIP CSV already uses a GitHub release URL (`sapics/ip-location-db`); that remains a **dependency**, not the whole of M2. M2 is about **proxy node material**, not the GeoIP database.

### Acceptance

#### M2.1 Fixtures

- [ ] Add at least **one** fixture file of share URIs (and optionally one base64 subscription blob) under `src/services/fixtures/github-nodes/`, with a one-line `README` stating origin (public gist/raw URL or “synthetic”).
- [ ] Parser helper (new small export or test-local): split lines, ignore comments/empties, collect `vless`/`trojan`/`vmess`/`ss`/`anytls` schemes.

#### M2.2 Offline tests (required)

- [ ] Fixture parses to a non-zero list of URIs.
- [ ] `nameOfUri` on fixture lines does not throw; empty fragment → `''`.
- [ ] Building `NodeRow`-like objects from fixture + synthetic `cc`/`delay` and running `pickForPush` yields **deterministic** counts (snapshot or explicit expect).

#### M2.3 Online probe (optional, skippable)

- [ ] Test marked skip without `SPIGOT_NET=1`: GET owner-approved public raw URL, expect 200, body contains at least one `://` share line.
- [ ] Failure mode: timeout / non-200 → test fail only when `SPIGOT_NET=1`, else skip.

#### M2.4 Definition of done for M2

- M2.1 + M2.2 green in default CI (`pnpm test`).
- M2.3 documented in SPEC and agent-log; not required for `done` if network is flaky.

---

## Agent queue (ordered)

| ID | Mainline | Item | Depends |
|----|----------|------|--------|
| T1 | M1 | Mock HTTP: `pushRows` success + error paths | — |
| T2 | M1 | Mock HTTP: `fetchRemotePool` + `#OFF#` | — |
| T3 | M1 | Mock round-trip push → get | T1, T2 |
| T4 | M1 | Switch request contract (mock) | — |
| T5 | M2 | Fixtures + parse + `pickForPush` offline tests | — |
| T6 | M2 | Optional `SPIGOT_NET=1` raw GitHub GET | T5 |
| T7 | M1 | Optional live Deno env smoke | T3 |

Agent should take **lowest ID not done**. Mark items in this file’s checkboxes when merging.

---

## Automation (not enabled until owner says so)

Planned behaviour for a future Spigot hourly agent:

1. Read this SPEC + `docs/agent-log/`.
2. Implement next open `T*` item on a branch `agent/tN-short-name`.
3. Run `pnpm test` (and typecheck if already in CI).
4. Open PR or push branch; append agent-log.
5. Stop after one item per hour.

**Do not enable the automation until T1–T5 acceptance text is still accurate and owner confirms.**

---

## Open points for owner (do not block T1–T5)

1. Exact Deno Deploy base URL and whether pool is `GET /push` or another path (document in `.env.example` only as variable names).
2. Preferred public GitHub raw/gist URL for M2.3, if any; otherwise synthetic fixtures only.
3. Whether live T7 is required before declaring M1 “done” for product use.
