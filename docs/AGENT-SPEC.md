# Spigot agent SPEC

**Status**: active · 2026-10-26 (owner decisions locked)  
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

## Owner decisions (2026-10-26)

| # | Decision |
|---|----------|
| 1 | **Pool path**: `GET` on the **same origin** as `pushUrl`, path `/push` (same host; `switchUrlOf` → `/switch`). Document variable names only in `.env.example` when added. |
| 2 | **M2 source list**: Expected to live in a **config file under `scripts/`** listing pages/URLs the owner wants fetched. **Audit 2026-10-26: no such file exists** → **BUG-M2-001** (owner will fix; agent must not invent URLs). |
| 3 | **Live / real Deno**: Owner will smoke-test manually when free. **M1 `done` = offline mock contract tests only** (T1–T4). T7 stays optional and is not a gate. |

---

## Known bugs blocking or shaping the queue

### BUG-M2-001 — missing scrape-sources config

- **Found**: 2026-10-26
- **Expected**: A config under `scripts/` (e.g. `scripts/node-sources.json` or similar) listing GitHub pages / raw / gist URLs to fetch for node tests.
- **Actual**: No such file. `scripts/` only has build/portable/i18n/updater helpers. No `filename:sources*`, no `raw.githubusercontent` references in app code except the **GeoIP CSV** hardcode in `deno-push.ts` (`sapics/ip-location-db`), which is **not** the node-list source list.
- **Also missing**: `src/services/fixtures/github-nodes/` (SPEC placeholder; not created yet).
- **Owner action**: add the config (and optionally seed fixtures).
- **Agent action until fixed**: M2 offline work may use **synthetic** fixtures only; **do not** invent public scrape URLs. T6 (`SPIGOT_NET=1`) stays blocked until BUG-M2-001 is closed or owner pastes URLs into the config.

---

## M1 — 打通读写 (Deno bidirectional)

### Goal

Prove and lock the **write path** (client → Deno `/push`) and the **read path** (Deno → client: pool + switch), so “双向都通” is measurable without relying on manual guesswork.

### Current code map (main)

| Direction | Client | Server (nodes-sub / Deno Deploy — out of this repo) |
|-----------|--------|------------------------------------------------------|
| Write | `pushRows` / `pushToDeno` → `POST pushUrl` + key | `/push` |
| Read pool | `fetchRemotePool` → `GET` same origin as push | **`GET /push`** (locked) |
| Read switch | switch UI → `switchUrlOf(pushUrl)` | `/switch` |

Pure helpers already unit-tested: `pickForPush`, `switchUrlOf`, `nameOfUri`, GeoIP, `toShareUri`, etc. **Missing: contract tests against a mocked HTTP boundary for both directions.**

### Acceptance

#### M1.1 Write path (client → server)

- [ ] Given a **mock** HTTP server that accepts `POST` with the project’s auth header/body shape, `pushRows` sends the expected payload and treats 2xx as success.
- [ ] Non-2xx and network failure surface a **structured** error (no silent empty success).
- [ ] `minKeep` / empty selection: client **refuses** to push when below threshold (existing product rule); test locks that behaviour.

#### M1.2 Read path (server → client)

- [ ] `fetchRemotePool` parses a fixture body that matches the server’s list format (including `#OFF# ` disabled prefix if still in protocol).
- [ ] Round-trip invariant test: **push fixture set → fetch pool → names/URIs contain the pushed set** (mock server implementing both POST and GET on `/push`).
- [ ] Switch request URL/method contract against mock (builds on existing `switchUrlOf` unit tests).

#### M1.3 Definition of done for M1

- All boxes in M1.1–M1.2 checked (mock only).
- `pnpm test` green on the new tests.
- Agent-log note: “M1 contract tests landed”.
- **Live Deno is owner-owned** (decision 3); not required for M1 done.

### Out of scope for M1

- Redesigning GeoIP or scan UI.
- Changing Clash upstream merge behaviour.
- Auto-updater / signing.

---

## M2 — GitHub 可抓取节点测试

### Goal

Automated tests for **nodes (or node lists) that can be fetched from GitHub** — raw / gist / release asset — so parsing and pipeline behaviour does not depend on a running Clash core.

### Interpretation

| In scope | Out of scope |
|----------|----------------|
| Config-driven URL list under `scripts/` (**BUG-M2-001** until present) | Inventing scrape targets without owner config |
| In-repo fixtures under `src/services/fixtures/github-nodes/` (synthetic OK until config exists) | Scraping arbitrary HTML without a listed URL |
| Offline parse + `pickForPush` determinism | Committing secrets |
| Optional net probe only after config lists URLs | Treating GeoIP CSV URL as the node source list |

### Acceptance

#### M2.1 Fixtures / config

- [ ] **BUG-M2-001 closed**: `scripts/` contains the owner’s source URL config (format owner chooses; document path in this SPEC when added).
- [ ] At least one fixture under `src/services/fixtures/github-nodes/` (synthetic allowed while bug open).
- [ ] Parser helper: split lines, ignore comments/empties, collect supported schemes.

#### M2.2 Offline tests (required for M2 done)

- [ ] Fixture parses to a non-zero list of URIs.
- [ ] `nameOfUri` on fixture lines does not throw; empty fragment → `''`.
- [ ] `pickForPush` with synthetic `cc`/`delay` yields deterministic counts.

#### M2.3 Online probe (optional; blocked on BUG-M2-001)

- [ ] With `SPIGOT_NET=1`, GET each URL from the scripts config; expect 200 and at least one share line where applicable.
- [ ] Without `SPIGOT_NET=1`, skip.

#### M2.4 Definition of done for M2

- M2.1 (bug closed + fixture) + M2.2 green in default CI.
- M2.3 not required for `done`.

---

## Agent queue (ordered)

| ID | Mainline | Item | Depends |
|----|----------|------|--------|
| T1 | M1 | Mock HTTP: `pushRows` success + error paths | — |
| T2 | M1 | Mock HTTP: `fetchRemotePool` + `#OFF#` | — |
| T3 | M1 | Mock round-trip push → get | T1, T2 |
| T4 | M1 | Switch request contract (mock) | — |
| T5 | M2 | Synthetic fixtures + parse + `pickForPush` offline | — |
| T6 | M2 | `SPIGOT_NET=1` GET from scripts config | T5 + **BUG-M2-001 fixed** |
| T7 | M1 | Live Deno smoke | T3 + owner env; **owner-run, not agent gate** |

Agent takes **lowest ID not done**. T6 must not invent URLs.

---

## Automation (not enabled until owner says so)

1. Read this SPEC + `docs/agent-log/`.
2. Implement next open `T*` on branch `agent/tN-short-name`.
3. Run `pnpm test` (and typecheck if in CI).
4. Open PR or push branch; append agent-log.
5. One item per hour max.

**Do not enable until owner confirms.**
