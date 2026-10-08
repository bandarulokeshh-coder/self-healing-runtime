# Formal Guarantees: Self-Healing Frontend Runtime

This document states what the runtime guarantees, over which error domain, under which
preconditions, and which concrete artifact checks each claim; measured overhead numbers
live in a separate performance document.

## 1. Overview and Scope

The runtime detects, diagnoses, and recovers from runtime errors in a React application
without page reloads; state lives in a single Zustand store and recovery is a rollback
to the latest invariant-satisfying checkpoint.

**Claimed.** For every error class in the defined taxonomy E (Section 2.3): routing to
the boundary UI without reload (Theorem 1); every admitted checkpoint satisfies I
(Theorem 2); R restores a state satisfying I whenever the pre-failure state did
(Theorem 3); loss bounded by one checkpoint interval (Theorem 4); snapshotting cost
asymptotically minimal and off the interaction path (Theorem 5).

**Not claimed.** "Every possible error" is scoped to the seven classes of E, and several
fundamental cases are undetectable from within JavaScript:

- **Infinite loops / hangs.** A blocked main thread runs no listener, no boundary, no
  timer — detection from inside the runtime is impossible (a concrete instance of the
  halting problem); only an external watchdog could observe it.
- **Out-of-memory.** The engine may abort execution before any handler runs, so no
  installed detection mechanism is guaranteed to execute.
- **Bootstrap failures.** Syntax errors or throws in the script that installs the
  listeners happen before detection exists.
- **Swallowed errors.** Third-party code that catches and discards exceptions never
  surfaces them to our mechanisms (cooperative-detection limit).

Also not claimed: recovery restores the last checkpointed state, not the exact
pre-crash state (the difference is precisely the loss window of Theorem 4); guarantees
are per tab/session, with cross-tab coordination best-effort (Section 5). Stating these
limits is what makes the theorems below credible rather than rhetorical.

## 2. Formal Definitions

### 2.1 State and snapshot chain

A **state** s in S is the store content relevant to recovery: `form` with exactly five
string fields (`name`, `email`, `address`, `phone`, `message`), plus `snapshots` (a ring
buffer) and `recoveryLogs`. canon(s) denotes the canonical JSON serialization of s and
**|S| = |canon(s)|** its length. A **checkpoint** every **T = 2000 ms** deep-copies the
state via `JSON.parse(JSON.stringify(state))` and stores `(id, timestamp, state)` in the
ring of at most **k = 50** entries (oldest evicted). The **snapshot sequence** is
sigma_0, ..., sigma_n with sigma_i = (id_i, t_i, s_i), t_0 <= ... <= t_n, and n < 50.

**Admission rule.** The invariant checker runs on every snapshot attempt; a snapshot
that fails any invariant is *rejected* (not stored). Consequently the stored chain
contains only states satisfying I.

### 2.2 Invariant set I

Six named pure functions, each of the form (state | chain) -> { name, passed, detail },
individually recordable and re-runnable; **I(s)** denotes their conjunction:

| Invariant | Scope | Condition |
|---|---|---|
| TYPE_INTEGRITY | state | all five form fields are strings (no null/undefined) |
| EMAIL_FORMAT | state | `email` matches the RFC-ish regex or is empty |
| SCHEMA_KEYS | state | `form` has exactly the five known keys, no extras |
| CONTROL_CHARS | state | no control characters in any field |
| RING_BOUND | chain | snapshots.length <= 50 |
| TIMESTAMP_MONOTONIC | chain | snapshot timestamps non-decreasing |

### 2.3 Error taxonomy E

E = { RENDER_CRASH, EVENT_HANDLER, ASYNC_TIMEOUT, UNHANDLED_REJECTION, SCRIPT_ERROR,
NETWORK, STATE_INVARIANT }, each with a detection mechanism:

| Class | Mechanism |
|---|---|
| RENDER_CRASH | React error boundary (`getDerivedStateFromError` / `componentDidCatch`) |
| EVENT_HANDLER | `window` "error" listener (uncaught throw in event dispatch) |
| ASYNC_TIMEOUT | `window` "error" listener (uncaught throw in `setTimeout`/async timer) |
| UNHANDLED_REJECTION | `window` "unhandledrejection" listener |
| SCRIPT_ERROR | `window` "error" listener (third-party / injected script) |
| NETWORK | explicit runtime report for failed fetch/resource requests |
| STATE_INVARIANT | invariant checker, run on each snapshot attempt and on demand; a violation is reported explicitly |

### 2.4 Recovery operator R and loss window

**R(s)**: (1) select the latest snapshot in the chain (which satisfies I by the
admission rule); (2) deep-copy it into the store; (3) reset the boundary error state
(`hasError` back to false); (4) issue a recovery certificate. R is sub-millisecond in
practice because step (2) is one JSON round trip.

**Loss window Delta** is the age of the newest admitted checkpoint at the moment of
failure; **epsilon** is the wall-clock duration of one checkpoint cycle (serialize +
invariant check + ring insert).

### 2.5 Recovery certificate

A JSON object with fields: `id`, `issuedAt`, `errorClass`, `errorMessage`, `preStateHash`,
`postStateHash`, `snapshotId`, `snapshotTimestamp`, `lossWindowMs`, `recoveryDurationMs`,
`invariants: [{name, passed, detail}]`, `verified`, `certificateHash`. State hashes are
djb2 hashes of canon(s) at the point recorded; `certificateHash` is the djb2 hash of the
canonical certificate with `certificateHash` itself removed.

## 3. Theorems

**Theorem 1 (Detection completeness over E).** For every class c in E and every error
e raised in class c after detector initialization, e reaches the boundary recovery UI
without `location.reload()`.

*Proof sketch (case analysis over E).* RENDER_CRASH: a throw during render propagates to the
nearest error boundary by React semantics; `getDerivedStateFromError` sets the fallback state,
`componentDidCatch` logs it, and the recovery UI renders. EVENT_HANDLER, ASYNC_TIMEOUT and
SCRIPT_ERROR: per HTML semantics a throw escaping an event listener, timer callback, or
third-party script is reported to the window, firing our "error" listener (SCRIPT_ERROR may
carry an opaque message, but the event fires). UNHANDLED_REJECTION fires its dedicated
listener; NETWORK and STATE_INVARIANT do not reliably surface as window events, so the runtime
reports them explicitly through the same entry point. All seven converge: the detector store's
`report` sets `activeError` and the boundary renders the recovery UI from it (render crashes
enter the same UI via the boundary's own derived state). No path calls `location.reload()`;
reload exists only as an explicit user-clickable escape hatch. Hence detection is complete
over E. QED.

*Machine check:* `src/core/ErrorDetector.ts` (`ERROR_CLASSES` + the `error` /
`unhandledrejection` listeners) and `src/core/SelfHealingBoundary.tsx` are the
executable spec; each surfacing path is triggerable from `src/demo/ErrorButtons.tsx`.

**Theorem 2 (Checkpoint integrity).** For every sigma_i in the chain, I(s_i) holds; i.e.
every stored state satisfies all six invariants.

*Proof sketch.* By the admission rule, every snapshot is evaluated against the checker before
storage, and any state failing an invariant is rejected rather than stored, so the four
state-level invariants hold for every admitted s_i. RING_BOUND holds because the ring evicts
at 50 entries on push; TIMESTAMP_MONOTONIC holds because timestamps come from a single
non-decreasing clock within a session. By induction over the push order, I holds for every
element of the chain. QED.

*Machine check:* the checker in `src/core/Invariants.ts` plus the rejection gate in
`src/core/SnapshotManager.ts`, exercised by the property-based tests under `tests/`.

**Theorem 3 (Recovery completeness / invariant restoration).** If the pre-failure state
satisfied I and at least one checkpoint has been admitted, then R restores a state s'
with I(s'), and `certificate.verified` is true exactly when the post-conditions re-verified.

*Proof sketch.* The premise plus the admission rule implies the chain is non-empty and every
element satisfies I (Theorem 2); R selects the latest element sigma_j, so I(s_j). The restore
is a JSON deep copy: for five string fields `JSON.parse(JSON.stringify(-))` preserves values
exactly, so all state-level invariants are preserved by copying, and the chain-level
invariants are structural. Afterwards every invariant is re-run on s' and postStateHash
recomputed from the actual restored state; `verified` is true only if all six pass *and* the
hash matches. Hence a state satisfying I exists post-recovery, attested by a re-checkable
certificate. QED.

*Machine check:* `node scripts/verify-certificates.mjs` re-runs verification;
`npx vitest run tests/unit/recovery.certificates.test.ts` asserts the post-conditions on
randomized states.

**Theorem 4 (Bounded state loss).** Delta <= T + epsilon: at most one checkpoint interval
(2000 ms) plus one checkpoint cycle of user input is lost, never the whole session.

*Proof sketch.* Checkpoints are admitted on a fixed period T, so at the moment of
failure the newest admitted checkpoint is at most one period T old, plus the epsilon the
in-flight cycle (serialize + check) took to commit. Edits after that checkpoint are
lost; everything at or before it is restored. The ring retains up to k = 50 historical
states, so recovery never regresses below the newest admitted checkpoint. QED.

*Machine check:* the T = 2000 ms interval in `src/App.tsx` and the ring bound in
`src/core/SnapshotManager.ts`; each certificate records `lossWindowMs` for the verifier.

**Theorem 5 (Non-interference and cost).** Snapshotting is off the interaction path;
per-cycle overhead is O(|S|), amortized O(|S|/T) per unit time; no reload cost.

*Proof sketch.* Checkpointing runs from a timer, not from input handlers: the interaction
path (`updateForm`) performs only a shallow field merge, O(number of changed fields),
independent of |S|. One cycle costs O(|S|) for the mandatory JSON deep copy (canonical
serialization must traverse the whole state) plus O(|I|) for the checker — asymptotically
optimal, since any correct snapshot must at least read the state — and dividing by the
period T gives amortized O(|S|/T) per unit time. Memory is O(k * |S|) with k = 50; detection
is O(1) per event (listener dispatch plus one store write); restore is O(|S|); certificate
issuance is O(|S| + |I|). No path performs a document reload, so reload cost (module
re-initialization, asset refetch, full re-render) is excluded by construction. QED.

*Machine check:* timer placement vs. handler placement in `src/App.tsx` and
`src/core/SnapshotManager.ts`; measured timings in the separate performance document.

**Corollary 1 (Idempotence of R).** R(R(s)) = R(s).

*Proof sketch.* R is a pure overwrite of the store with the latest snapshot's content and
does not mutate the chain; applying it twice with an unchanged chain installs the same
content twice, and djb2 over canonical JSON is deterministic, so both applications yield
identical `postStateHash` and `certificateHash`. QED.

*Machine check:* `npx vitest run tests/unit/recovery.certificates.test.ts` — double recovery
asserts equal hashes.

## 4. Machine-Checkable Certificates

A certificate is issued by R on every recovery: identity (`id`, `issuedAt`), what failed
(`errorClass`, `errorMessage`), where recovery started and landed (`preStateHash`,
`postStateHash`, `snapshotId`, `snapshotTimestamp`), loss and duration (`lossWindowMs`,
`recoveryDurationMs`), the per-invariant vector `invariants: [{name, passed, detail}]`,
the verdict `verified`, and the self-hash `certificateHash` (Section 2.5).

**`verified: true` means concretely:** (a) every one of the six invariants was re-run
against the restored post-state and returned `passed: true`; (b) `postStateHash` equals
the djb2 hash of canon(postState) recomputed from the actual restored state, i.e. the
certificate describes the state really in the store; and (c) `certificateHash` equals
the djb2 hash of the canonical certificate with `certificateHash` removed, so no field
was edited since issuance.

Run the standalone verifier — `node scripts/verify-certificates.mjs` — to read the
certificate JSON files and perform the three checks above, re-running each named
invariant. Run the property-based randomized tests —
`npx vitest run tests/unit/recovery.certificates.test.ts` — which generate states and
failures, recover, and assert Theorem 3 and Corollary 1.

djb2 is a deterministic integrity hash, not a cryptographic one: certificates are
self-consistency evidence, not authentication against an adversary who can rewrite both.

## 5. Limitations and Future Work

- **Undecidable cases.** Hangs, pre-handler OOM, and bootstrap failures (Section 1)
  cannot be detected from within JS; a cross-process watchdog would be required.
- **Multi-tab.** Coordination is best-effort via BroadcastChannel heartbeats with no
  consensus, so a "crashed tab" verdict can be wrong when a tab merely slept.
- **Persistence.** Snapshots live in memory; localStorage persistence is not yet
  crash-proof (writes are not journaled), so a browser crash loses the ring.
- **Clock assumption.** TIMESTAMP_MONOTONIC assumes a non-decreasing wall clock; a
  backwards adjustment rejects an otherwise valid snapshot (fail-safe: never admitted).
- **Cooperative detection.** NETWORK and STATE_INVARIANT rely on explicit reports; code
  that swallows its own failures bypasses them (Section 1).
- **Future work:** journaled persistence with checksummed segments; a watchdog for hang
  detection; MAC-based certificates; machine-checked proofs replacing the sketches here.

## 6. References

- React, *Error Boundaries*; MDN, *Window: error event* / *unhandledrejection event* —
  the detection primitives.
- Lamport (1978); Chandy & Lamport (1985) — checkpoint/rollback foundations. Kramer &
  Magee (2007); Garlan & Shen (2003) — self-healing software literature. djb2 (Bernstein)
  — deterministic non-cryptographic hashing.

## Artifact ↔ Guarantee Mapping

| Guarantee | Artifact |
|---|---|
| Theorem 1 (detection over E) | `src/core/ErrorDetector.ts`, `src/core/SelfHealingBoundary.tsx`, `src/demo/ErrorButtons.tsx` |
| Theorem 2 (checkpoint integrity) | `src/core/Invariants.ts`, `src/core/SnapshotManager.ts`, property tests in `tests/` |
| Theorem 3 (recovery completeness) | `scripts/verify-certificates.mjs`, `tests/unit/recovery.certificates.test.ts` |
| Theorem 4 (bounded state loss) | T = 2000 ms timer in `src/App.tsx`, ring bound in `src/core/SnapshotManager.ts`, `lossWindowMs` in certificates |
| Theorem 5 (non-interference / cost) | timer-vs-handler placement in `src/App.tsx` + `src/core/SnapshotManager.ts`; measurements in the performance doc |
| Corollary 1 (idempotence) | `tests/unit/recovery.certificates.test.ts` |
| Certificate verifiability | `scripts/verify-certificates.mjs`, `src/core/Invariants.ts` |
| Multi-tab (limitation) | `src/core/MultiTabSync.ts` |
