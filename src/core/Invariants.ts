/**
 * Machine-checkable state invariants (the set I of the formal spec).
 * Every invariant is a named pure function so certificates can record
 * per-invariant results and a standalone verifier can re-run them.
 */

export const FORM_SCHEMA_KEYS = ['name', 'email', 'address', 'phone', 'message'] as const

export interface InvariantResult {
  name: string
  passed: boolean
  detail?: string
}

export interface InvariantDefinition<T> {
  name: string
  check: (state: T) => { passed: boolean; detail?: string }
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
// eslint-disable-next-line no-control-regex
const CONTROL_CHARS_RE = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/

export interface FormState {
  name: string
  email: string
  address: string
  phone: string
  message: string
}

export interface AppSnapshotState {
  form: FormState
}

/** Shape passed to the checker: the store's snapshot-state shape ({ form }). */
type Checkable = Record<string, unknown>

const TYPE_INTEGRITY: InvariantDefinition<Checkable> = {
  name: 'TYPE_INTEGRITY',
  check: (state) => {
    const form = state.form as Record<string, unknown> | undefined
    if (!form || typeof form !== 'object') return { passed: false, detail: 'form missing or not an object' }
    for (const key of FORM_SCHEMA_KEYS) {
      if (typeof form[key] !== 'string')
        return { passed: false, detail: `field "${key}" is ${form[key] === null ? 'null' : typeof form[key]}, expected string` }
    }
    return { passed: true }
  }
}

const EMAIL_FORMAT: InvariantDefinition<Checkable> = {
  name: 'EMAIL_FORMAT',
  check: (state) => {
    const email = (state.form as Record<string, unknown>)?.email
    if (typeof email !== 'string') return { passed: false, detail: 'email not a string' }
    if (email === '') return { passed: true }
    return EMAIL_RE.test(email)
      ? { passed: true }
      : { passed: false, detail: `email "${email.slice(0, 40)}" does not match required format` }
  }
}

const SCHEMA_KEYS: InvariantDefinition<Checkable> = {
  name: 'SCHEMA_KEYS',
  check: (state) => {
    const form = state.form as Record<string, unknown> | undefined
    if (!form) return { passed: false, detail: 'form missing' }
    const keys = Object.keys(form).sort()
    const expected = [...FORM_SCHEMA_KEYS].sort()
    const extra = keys.filter((k) => !expected.includes(k as any))
    const missing = expected.filter((k) => !keys.includes(k))
    if (extra.length || missing.length)
      return { passed: false, detail: `extra=[${extra}] missing=[${missing}]` }
    return { passed: true }
  }
}

const CONTROL_CHARS: InvariantDefinition<Checkable> = {
  name: 'CONTROL_CHARS',
  check: (state) => {
    const form = state.form as Record<string, unknown> | undefined
    if (!form) return { passed: false, detail: 'form missing' }
    for (const key of FORM_SCHEMA_KEYS) {
      const v = form[key]
      if (typeof v === 'string' && CONTROL_CHARS_RE.test(v))
        return { passed: false, detail: `field "${key}" contains control characters` }
    }
    return { passed: true }
  }
}

export const STATE_INVARIANTS: InvariantDefinition<Checkable>[] = [
  TYPE_INTEGRITY,
  EMAIL_FORMAT,
  SCHEMA_KEYS,
  CONTROL_CHARS
]

/** Chain-level invariants (checked against the snapshot ring, not one state). */
export const CHAIN_INVARIANTS = {
  RING_BOUND: (snapshotCount: number, max = 50) => ({
    name: 'RING_BOUND',
    passed: snapshotCount <= max,
    detail: snapshotCount <= max ? undefined : `${snapshotCount} > ${max}`
  }),
  TIMESTAMP_MONOTONIC: (timestamps: number[]) => {
    for (let i = 1; i < timestamps.length; i++) {
      if (timestamps[i] < timestamps[i - 1])
        return { name: 'TIMESTAMP_MONOTONIC', passed: false, detail: `snapshot ${i} older than ${i - 1}` }
    }
    return { name: 'TIMESTAMP_MONOTONIC', passed: true }
  }
}

/** Run every state invariant; returns per-invariant results. */
export function checkInvariants(state: Checkable): InvariantResult[] {
  return STATE_INVARIANTS.map((inv) => {
    try {
      const r = inv.check(state)
      return { name: inv.name, passed: r.passed, detail: r.detail }
    } catch (e: any) {
      return { name: inv.name, passed: false, detail: `checker threw: ${e?.message}` }
    }
  })
}

export function allInvariantsPass(results: InvariantResult[]): boolean {
  return results.every((r) => r.passed)
}

export function firstViolation(results: InvariantResult[]): InvariantResult | null {
  return results.find((r) => !r.passed) ?? null
}
