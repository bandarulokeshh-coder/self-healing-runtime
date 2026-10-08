// @vitest-environment node
/**
 * Machine-checkable recovery guarantee tests (property-based).
 *
 * These tests are the executable form of the theorems in
 * docs/FORMAL_GUARANTEES.md:
 *   - Checkpoint Integrity  -> randomized rejection tests
 *   - Recovery Completeness -> restore always yields a state in I
 *   - Idempotence of R       -> restoring twice yields identical state
 *   - Certificate validity   -> issue/verify, tamper detection
 *   - Offline agreement      -> scripts/verify-certificates.mjs verdicts match
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  issueCertificate,
  verifyCertificate,
  hashState,
  canonicalJson,
  djb2,
  useCertificateStore
} from '../../src/core/Certificate'
import { checkInvariants, allInvariantsPass, firstViolation, FORM_SCHEMA_KEYS } from '../../src/core/Invariants'
import { useSnapshotStore, takeSnapshot, getLatestSnapshot, restoreFromSnapshot, getForm } from '../../src/core/SnapshotManager'
import type { ErrorClass } from '../../src/core/ErrorDetector'

// ---------- deterministic PRNG so failures are reproducible ----------
function mulberry32(seed: number) {
  return () => {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const rand = mulberry32(0xc0ffee)

const VALID_EMAILS = ['a@b.co', 'user.name+tag@example.org', 'x@y.io']
const INVALID_EMAILS = ['not-an-email', 'a@@b', 'a b@c.d', 'corrupted@@not-an-email']
const CONTROL = ['bad\u0000null', 'bell\u0007', 'esc\u001b[31m']

function randomValidForm() {
  return {
    name: `User ${Math.floor(rand() * 1e6)}`,
    email: VALID_EMAILS[Math.floor(rand() * VALID_EMAILS.length)],
    address: `${Math.floor(rand() * 9999)} Random Street`,
    phone: `+1 (${100 + Math.floor(rand() * 899)}) 100-${1000 + Math.floor(rand() * 8999)}`,
    message: rand() > 0.5 ? 'note to seller' : ''
  }
}

type Mutation = 'none' | 'bad-email' | 'null-field' | 'extra-key' | 'missing-key' | 'control-chars' | 'wrong-type'

function randomState(mutation: Mutation) {
  const form: Record<string, unknown> = randomValidForm()
  switch (mutation) {
    case 'bad-email': form.email = INVALID_EMAILS[Math.floor(rand() * INVALID_EMAILS.length)]; break
    case 'null-field': form.name = null; break
    case 'extra-key': form.injected = 'unexpected'; break
    case 'missing-key': delete form.message; break
    case 'control-chars': form.message = CONTROL[Math.floor(rand() * CONTROL.length)]; break
    case 'wrong-type': form.phone = 12345; break
    case 'none': break
  }
  return { form }
}

const ALL_MUTATIONS: Mutation[] = ['none', 'none', 'bad-email', 'null-field', 'extra-key', 'missing-key', 'control-chars', 'wrong-type']
const EXPECTED_INVALID: Mutation[] = ['bad-email', 'null-field', 'extra-key', 'missing-key', 'control-chars', 'wrong-type']

const CLASS_SAMPLES: ErrorClass[] = [
  'RENDER_CRASH', 'EVENT_HANDLER', 'ASYNC_TIMEOUT',
  'UNHANDLED_REJECTION', 'SCRIPT_ERROR', 'NETWORK', 'STATE_INVARIANT'
]

beforeEach(() => {
  useSnapshotStore.setState({ snapshots: [], recoveryLogs: [] })
  useCertificateStore.setState({ certificates: [] })
})

afterEach(() => {
  useSnapshotStore.setState({ snapshots: [], recoveryLogs: [] })
  useCertificateStore.setState({ certificates: [] })
})

describe('invariant checker (set I)', () => {
  it('accepts 200 randomized valid states', () => {
    for (let i = 0; i < 200; i++) {
      const state = randomState('none')
      const results = checkInvariants(state)
      expect(firstViolation(results), `state #${i}: ${JSON.stringify(state)}`).toBeNull()
      expect(allInvariantsPass(results)).toBe(true)
    }
  })

  it('rejects every randomized invalid state, naming the violated invariant', () => {
    let rejected = 0
    for (let i = 0; i < 400; i++) {
      const mutation = ALL_MUTATIONS[Math.floor(rand() * ALL_MUTATIONS.length)]
      const state = randomState(mutation)
      const results = checkInvariants(state)
      const violated = !allInvariantsPass(results)
      if (EXPECTED_INVALID.includes(mutation)) {
        expect(violated, `mutation ${mutation} must violate I (state ${JSON.stringify(state)})`).toBe(true)
        rejected++
      } else {
        expect(violated, `mutation ${mutation} must satisfy I`).toBe(false)
      }
    }
    expect(rejected).toBeGreaterThan(100)
  })

  it('covers every schema key in TYPE_INTEGRITY failures', () => {
    for (const key of FORM_SCHEMA_KEYS) {
      const state = randomState('none') as any
      state.form[key] = 42
      const v = firstViolation(checkInvariants(state))
      expect(v).not.toBeNull()
      expect(v!.name).toBe('TYPE_INTEGRITY')
    }
  })
})

describe('Checkpoint Integrity (Theorem 2)', () => {
  it('rejects invalid states — they never enter the ring', () => {
    for (let i = 0; i < 100; i++) {
      const mutation = ALL_MUTATIONS[Math.floor(rand() * ALL_MUTATIONS.length)]
      const state = randomState(mutation)
      const before = useSnapshotStore.getState().snapshots.length
      const accepted = takeSnapshot(state)
      const after = useSnapshotStore.getState().snapshots.length
      if (EXPECTED_INVALID.includes(mutation)) {
        expect(accepted).toBe(false)
        expect(after).toBe(before)
      } else {
        expect(accepted).not.toBe(false)
        expect(after).toBeGreaterThanOrEqual(before)
      }
    }
  })

  it('every state stored in the ring satisfies I (exhaustive re-check)', () => {
    for (let i = 0; i < 30; i++) {
      const state = randomState('none')
      takeSnapshot(state)
      takeSnapshot(randomState(INVALID_EMAILS[i % INVALID_EMAILS.length] ? 'bad-email' : 'none'))
    }
    const ring = useSnapshotStore.getState().snapshots
    expect(ring.length).toBeGreaterThan(0)
    for (const snap of ring) {
      expect(allInvariantsPass(checkInvariants(snap.state)), `ring state ${snap.id} violates I`).toBe(true)
    }
  })

  it('enforces RING_BOUND: at most 50 checkpoints', () => {
    for (let i = 0; i < 120; i++) takeSnapshot(randomState('none'))
    expect(useSnapshotStore.getState().snapshots.length).toBe(50)
  })
})

describe('Recovery Completeness + Idempotence (Theorem 3, Corollary)', () => {
  it('R restores a state satisfying I, and R is idempotent', () => {
    // seed a known-good state, then take a second valid checkpoint
    const good = randomState('none')
    takeSnapshot(good)
    takeSnapshot(randomState('none'))

    // "crash": corrupt the live state in every way at once
    useSnapshotStore.setState((s: any) => {
      s.form.email = 'corrupted@@not-an-email'
      s.form.name = null
      s.form.injected = 'unexpected'
      s.form.message = 'bad\u0000null'
    })
    expect(allInvariantsPass(checkInvariants({ form: getForm() as any }))).toBe(false)

    restoreFromSnapshot()
    const post1 = { form: { ...getForm() } }
    const results1 = checkInvariants(post1)
    expect(firstViolation(results1)).toBeNull()

    const hash1 = hashState(post1)
    restoreFromSnapshot() // R again
    const hash2 = hashState({ form: { ...getForm() } })
    expect(hash2).toBe(hash1) // idempotence
  })

  it('bounded loss window: certificate lossWindowMs equals now - snapshot time', () => {
    takeSnapshot(randomState('none'))
    const snapshot = getLatestSnapshot()!
    // pretend the snapshot is 1500ms old (within the 2000ms interval bound);
    // snapshot objects are frozen by immer, so backdate via the certificate input
    const backdated = Date.now() - 1500
    restoreFromSnapshot()
    const cert = issueCertificate({
      errorClass: 'STATE_INVARIANT',
      errorMessage: 'test',
      preState: { form: { email: 'corrupted@@x' } },
      postState: { form: { ...getForm() } },
      snapshotId: snapshot.id,
      snapshotTimestamp: backdated,
      recoveryDurationMs: 0.4
    })
    expect(cert.lossWindowMs).toBeGreaterThanOrEqual(1500)
    expect(cert.lossWindowMs).toBeLessThan(2100) // <= T(2000) + epsilon
    expect(cert.verified).toBe(true)
    expect(verifyCertificate(cert).valid).toBe(true)

    // detectedAt pins Delta to the failure moment, excluding diagnosis/recovery wait
    const cert2 = issueCertificate({
      errorClass: 'RENDER_CRASH',
      errorMessage: 'detection-pinned',
      preState: {},
      postState: { form: { ...getForm() } },
      snapshotId: snapshot.id,
      snapshotTimestamp: backdated,
      detectedAt: backdated + 900,
      recoveryDurationMs: 3000 // long recovery must NOT inflate Delta
    })
    expect(cert2.lossWindowMs).toBeGreaterThanOrEqual(900)
    expect(cert2.lossWindowMs).toBeLessThan(1000)
    expect(cert2.recoveryDurationMs).toBe(3000)
  })
})

describe('Machine-checkable certificates', () => {
  it('issues a valid certificate for every error class', () => {
    takeSnapshot(randomState('none'))
    const snapshot = getLatestSnapshot()!
    for (const errorClass of CLASS_SAMPLES) {
      const cert = issueCertificate({
        errorClass,
        errorMessage: `simulated ${errorClass}`,
        preState: { form: { email: 'broken' } },
        postState: { form: { ...getForm() } },
        snapshotId: snapshot.id,
        snapshotTimestamp: snapshot.timestamp,
        recoveryDurationMs: 0.3
      })
      const v = verifyCertificate(cert, { form: { ...getForm() } })
      expect(v.valid, `${errorClass}: ${v.reasons.join('; ')}`).toBe(true)
      expect(cert.verified).toBe(true)
      expect(cert.invariants.map((i) => i.name).sort()).toEqual(
        ['CONTROL_CHARS', 'EMAIL_FORMAT', 'SCHEMA_KEYS', 'TYPE_INTEGRITY']
      )
    }
  })

  it('detects tampering with any recorded field (hash chain)', () => {
    takeSnapshot(randomState('none'))
    const snapshot = getLatestSnapshot()!
    const cert = issueCertificate({
      errorClass: 'RENDER_CRASH',
      errorMessage: 'original',
      preState: { form: { ...getForm() } },
      postState: { form: { ...getForm() } },
      snapshotId: snapshot.id,
      snapshotTimestamp: snapshot.timestamp,
      recoveryDurationMs: 0.2
    })

    const tampered = structuredClone(cert) as any
    tampered.errorMessage = 'swallowed the real error'
    expect(verifyCertificate(tampered).valid).toBe(false)
    expect(verifyCertificate(tampered).reasons.join(' ')).toMatch(/certificateHash/)

    const flippedInvariant = structuredClone(cert) as any
    flippedInvariant.invariants[0].passed = false
    expect(verifyCertificate(flippedInvariant).valid).toBe(false)
  })

  it('rejects a certificate whose post-state hash does not match reality', () => {
    const cert = issueCertificate({
      errorClass: 'NETWORK',
      errorMessage: 'fetch failed',
      preState: {},
      postState: { form: randomValidForm() },
      snapshotId: 's1',
      snapshotTimestamp: Date.now(),
      recoveryDurationMs: 0.1
    })
    expect(verifyCertificate(cert, { form: randomValidForm() }).valid).toBe(false)
  })

  it('canonicalJson is key-order independent; djb2 matches simple vectors', () => {
    expect(canonicalJson({ b: 1, a: 2 })).toBe(canonicalJson({ a: 2, b: 1 }))
    expect(djb2('')).toBe('00001505') // djb2 seed = 5381 = 0x1505
    expect(hashState({ x: 1 })).toBe(hashState({ x: 1 }))
    expect(hashState({ x: 1 })).not.toBe(hashState({ x: 2 }))
  })
})

describe('Offline verifier agreement (scripts/verify-certificates.mjs)', () => {
  let dir: string | null = null
  afterEach(() => {
    if (dir) { rmSync(dir, { recursive: true, force: true }); dir = null }
  })

  it('offline verifier accepts genuine certs and rejects tampered ones', () => {
    takeSnapshot(randomState('none'))
    const snapshot = getLatestSnapshot()!
    const genuine = issueCertificate({
      errorClass: 'ASYNC_TIMEOUT',
      errorMessage: 'timer threw',
      preState: { form: { ...getForm() } },
      postState: { form: { ...getForm() } },
      snapshotId: snapshot.id,
      snapshotTimestamp: snapshot.timestamp,
      recoveryDurationMs: 0.5
    })
    const tampered = structuredClone(genuine) as any
    tampered.errorMessage = 'edited offline'

    dir = mkdtempSync(join(tmpdir(), 'certs-'))
    const genuineFile = join(dir, 'genuine.json')
    const tamperedFile = join(dir, 'tampered.json')
    const stateFile = join(dir, 'post-state.json')
    writeFileSync(genuineFile, JSON.stringify([genuine], null, 2))
    writeFileSync(tamperedFile, JSON.stringify([tampered], null, 2))
    writeFileSync(stateFile, JSON.stringify({ form: { ...getForm() } }))

    const script = fileURLToPath(new URL('../../scripts/verify-certificates.mjs', import.meta.url))

    const goodOut = execFileSync(process.execPath, [script, genuineFile, '--state', stateFile], { encoding: 'utf8' })
    expect(goodOut).toMatch(/VERIFIED/)

    let failedAsExpected = false
    try {
      execFileSync(process.execPath, [script, tamperedFile], { encoding: 'utf8' })
    } catch (e: any) {
      failedAsExpected = e.status === 1 && String(e.stdout).includes('tampered')
    }
    expect(failedAsExpected, 'offline verifier must exit 1 on a tampered certificate').toBe(true)
  })
})
