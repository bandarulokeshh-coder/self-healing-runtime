# Self-Healing Runtime

> Production-ready error boundaries with AI-powered diagnosis and automatic state recovery

## Installation

```bash
npm install @lukee1603/self-healing-runtime
```

## Usage

```tsx
import { SelfHealingBoundary } from '@lukee1603/self-healing-runtime';

function App() {
  return (
    <SelfHealingBoundary>
      <YourApp />
    </SelfHealingBoundary>
  );
}
```

## Features

- ✅ Zero Data Loss - Automatic snapshots every 2 seconds (invariant-checked)
- ✅ Lightning Recovery - Restores state in <1ms
- ✅ AI Diagnosis - Root cause analysis with confidence scores
- ✅ Time-Travel - Browse 50 snapshots with diff viewer
- ✅ Multi-Tab Support - Recover from crashed browser tabs
- ✅ Performance Monitoring - Real-time Web Vitals graphs
- ✅ E-commerce Ready - WooCommerce, Shopify integration
- ✅ WordPress Plugin - Drop-in installation

## Formal guarantees & machine-checkable certificates

This repository targets the problem statement's four deliverables:

| Deliverable | Artifact |
|---|---|
| Formal recovery completeness theorems | [docs/FORMAL_GUARANTEES.md](docs/FORMAL_GUARANTEES.md) — 5 theorems + corollary, each with a machine-check reference |
| Error-class recovery demonstrations | 6 real scenarios in the demo (Render Crash, Event Handler, Async Timeout, Unhandled Rejection, Network, State Inconsistency), each reaching the detector → boundary → recovery path |
| State consistency certificates | `RecoveryCertificate` issued on every restore; re-verify in the dashboard or offline with `scripts/verify-certificates.mjs` |
| Performance overhead analysis | [docs/PERFORMANCE.md](docs/PERFORMANCE.md) — measured O(\|S\|) fit R² = 0.9999, 0.0118 % main-thread overhead per 2 s cycle |

### Verification

```bash
# property-based guarantee tests (checkpoint integrity, recovery, certificates)
npx vitest run

# standalone certificate verifier (machine-checkable, no app required)
node scripts/verify-certificates.mjs recovery-certificates.json --state post-state.json

# performance benchmarks (writes bench-results.json)
node --expose-gc scripts/bench.mjs
```

### Error taxonomy covered

`RENDER_CRASH` · `EVENT_HANDLER` · `ASYNC_TIMEOUT` · `UNHANDLED_REJECTION` · `SCRIPT_ERROR` · `NETWORK` · `STATE_INVARIANT`

Detection: React error boundary (render), `window error` listener (timers,
event handlers, third-party scripts), `unhandledrejection` listener, and an
invariant checker that rejects any checkpoint state violating I.

## License

MIT
