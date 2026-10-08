#!/usr/bin/env node
/**
 * Performance overhead micro-benchmarks for the Self-Healing Runtime.
 *
 * Measures the actual costs behind the asymptotic claims in
 * docs/FORMAL_GUARANTEES.md / docs/PERFORMANCE.md:
 *   - snapshot / restore cost  (JSON deep copy) vs state size  -> O(|S|)
 *   - certificate hashing cost (canonical JSON + djb2)         -> O(|S|)
 *   - ring-buffer push/shift (50-entry checkpoint ring)        -> O(1) amortized
 *   - detection cost (window 'error' listener dispatch)        -> O(1)
 *   - memory footprint of a full 50-checkpoint ring            -> O(k*|S|)
 *
 * Usage: node scripts/bench.mjs [out.json]
 */
import { writeFileSync } from 'node:fs'

// ---------- helpers (same algorithms as the runtime) ----------
function djb2(input) {
  let hash = 5381
  for (let i = 0; i < input.length; i++) hash = ((hash << 5) + hash + input.charCodeAt(i)) | 0
  return (hash >>> 0).toString(16).padStart(8, '0')
}
function canonicalJson(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null'
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`
  const keys = Object.keys(value).sort()
  return `{${keys.map((k) => `${JSON.stringify(k)}:${canonicalJson(value[k])}`).join(',')}}`
}

/** Build a form-shaped state whose canonical serialization is ~targetBytes. */
function makeState(targetBytes) {
  const overhead = 200
  const padLen = Math.max(0, targetBytes - overhead)
  return {
    form: {
      name: 'Recovery Test User',
      email: 'test@example.com',
      address: `${padLen} Main Street`,
      phone: '+1 (555) 010-0100',
      message: 'x'.repeat(padLen)
    }
  }
}

/** Time fn() repeatedly for at least minMs / minOps; returns stats in ns. */
function bench(name, fn, { minOps = 30, minMs = 250, maxOps = 200000 } = {}) {
  fn() // warm up / compile
  const times = []
  let ops = 0
  const t0 = process.hrtime.bigint()
  while (ops < maxOps && (ops < minOps || Number(process.hrtime.bigint() - t0) < minMs)) {
    const s = process.hrtime.bigint()
    fn()
    times.push(Number(process.hrtime.bigint() - s))
    ops++
  }
  times.sort((a, b) => a - b)
  const sum = times.reduce((a, b) => a + b, 0)
  const pct = (p) => times[Math.min(times.length - 1, Math.floor((p / 100) * times.length))]
  return {
    name,
    ops,
    meanNs: Math.round(sum / times.length),
    medianNs: pct(50),
    p95Ns: pct(95),
    opsPerSec: Math.round(1e9 / (sum / times.length))
  }
}

const results = { meta: { node: process.version, platform: process.platform, date: new Date().toISOString() }, sizes: [], ring: null, detection: null, memory: null }

// ---------- 1. snapshot/restore & hash vs state size ----------
const targets = [1_000, 10_000, 100_000, 1_000_000, 5_000_000]
for (const bytes of targets) {
  const state = makeState(bytes)
  const canonical = canonicalJson(state)
  const actualBytes = Buffer.byteLength(JSON.stringify(state))

  const snapshot = bench(`snapshot(JSON deep copy) @ ${actualBytes}B`, () => JSON.parse(JSON.stringify(state)))
  const restore = bench(`restore(JSON deep copy) @ ${actualBytes}B`, () => JSON.parse(JSON.stringify(state)))
  const hash = bench(`certificate hash (canonical+djb2) @ ${actualBytes}B`, () => djb2(canonicalJson(state)))

  results.sizes.push({
    stateBytes: actualBytes,
    canonicalBytes: Buffer.byteLength(canonical),
    snapshot,
    restore,
    hash
  })
  console.log(
    `${String(actualBytes).padStart(9)} B | snapshot ${String(snapshot.medianNs).padStart(9)} ns | restore ${String(restore.medianNs).padStart(9)} ns | hash ${String(hash.medianNs).padStart(9)} ns`
  )
}

// ---------- 2. ring buffer (k=50) at 100 KB/state ----------
{
  const state = makeState(100_000)
  const ring = []
  const pushShift = bench('ring push/shift @ 100KB state', () => {
    ring.push({ state: JSON.parse(JSON.stringify(state)), t: Date.now() })
    if (ring.length > 50) ring.shift()
  }, { minOps: 200 })
  results.ring = pushShift
  console.log(`ring push/shift (cap 50): ${pushShift.medianNs} ns/op`)
}

// ---------- 3. detection dispatch (window 'error' listener) ----------
{
  const listeners = []
  let detected = 0
  listeners.push((e) => { detected++ })
  const ev = { message: 'boom', error: new Error('boom') }
  const dispatch = bench('detection: window error dispatch (1 listener)', () => {
    for (const l of listeners) l(ev)
  })
  results.detection = dispatch
  console.log(`detection dispatch: ${dispatch.medianNs} ns/op (listeners fired: ${detected})`)
}

// ---------- 4. memory of a full 50-checkpoint ring ----------
{
  const state = makeState(100_000)
  global.gc?.()
  const before = process.memoryUsage().heapUsed
  const ring = []
  for (let i = 0; i < 50; i++) ring.push({ state: JSON.parse(JSON.stringify(state)), t: Date.now() + i })
  const after = process.memoryUsage().heapUsed
  results.memory = { states: 50, bytesPerState: 100_000, heapDeltaBytes: after - before, ringLength: ring.length }
  console.log(`50 x 100KB ring heap delta: ${((after - before) / 1024 / 1024).toFixed(1)} MB`)
}

// ---------- linear fit: does time scale with |S|? (O(|S|) evidence) ----------
{
  const xs = results.sizes.map((s) => s.stateBytes)
  const ys = results.sizes.map((s) => s.snapshot.medianNs)
  const n = xs.length
  const mx = xs.reduce((a, b) => a + b, 0) / n
  const my = ys.reduce((a, b) => a + b, 0) / n
  let num = 0, den = 0
  for (let i = 0; i < n; i++) { num += (xs[i] - mx) * (ys[i] - my); den += (xs[i] - mx) ** 2 }
  const slope = num / den
  let ssTot = 0, ssRes = 0
  for (let i = 0; i < n; i++) {
    ssTot += (ys[i] - my) ** 2
    const pred = my + slope * (xs[i] - mx)
    ssRes += (ys[i] - pred) ** 2
  }
  results.linearFit = { slopeNsPerByte: slope, rSquared: 1 - ssRes / ssTot }
  console.log(`snapshot time ~ |S| linear fit: slope=${slope.toExponential(3)} ns/byte, R^2=${(1 - ssRes / ssTot).toFixed(4)}`)
}

// ---------- overhead vs the 2000ms snapshot interval ----------
const typical = results.sizes.find((s) => s.stateBytes >= 100_000 && s.stateBytes <= 200_000) ?? results.sizes[2]
results.overhead = {
  snapshotIntervalMs: 2000,
  typicalStateBytes: typical.stateBytes,
  snapshotMedianNs: typical.snapshot.medianNs,
  fractionOfInterval: typical.snapshot.medianNs / 2e9,
  percentOfMainThreadPerCycle: (typical.snapshot.medianNs / 1e6 / 2000) * 100
}
console.log(
  `overhead: snapshot ${typical.snapshot.medianNs} ns every 2000 ms => ${results.overhead.percentOfMainThreadPerCycle.toFixed(6)}% of one second of main thread`
)

const out = process.argv[2] ?? 'bench-results.json'
writeFileSync(out, JSON.stringify(results, null, 2))
console.log(`\nwritten: ${out}`)
