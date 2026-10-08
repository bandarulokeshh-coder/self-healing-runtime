#!/usr/bin/env node
/**
 * Standalone verifier for recovery certificates (machine-checkable guarantee).
 *
 * Usage:
 *   node scripts/verify-certificates.mjs <certificates.json> [--state <postState.json>]
 *
 * Verifies, without trusting the issuer:
 *   1. certificateHash == djb2(canonicalJson(certificate minus hash))  (tamper evidence)
 *   2. every recorded invariant result passed
 *   3. certificate was issued with verified=true
 *   4. with --state: re-hash the actual restored state and re-run invariants
 *
 * The hash/invariant logic below mirrors src/core/Certificate.ts and
 * src/core/Invariants.ts exactly; tests/unit/recovery.certificates.test.ts
 * asserts the browser-side and offline paths agree.
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

// --- djb2 (identical to src/core/Certificate.ts) ---
function djb2(input) {
  let hash = 5381
  for (let i = 0; i < input.length; i++) {
    hash = ((hash << 5) + hash + input.charCodeAt(i)) | 0
  }
  return (hash >>> 0).toString(16).padStart(8, '0')
}

// --- canonical JSON (identical to src/core/Certificate.ts) ---
function canonicalJson(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null'
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`
  const keys = Object.keys(value)
    .filter((k) => value[k] !== undefined)
    .sort()
  return `{${keys.map((k) => `${JSON.stringify(k)}:${canonicalJson(value[k])}`).join(',')}}`
}

const hashState = (state) => djb2(canonicalJson(state))

// --- invariants (identical to src/core/Invariants.ts) ---
const FORM_SCHEMA_KEYS = ['name', 'email', 'address', 'phone', 'message']
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const CONTROL_CHARS_RE = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/

const INVARIANTS = {
  TYPE_INTEGRITY: (state) => {
    const form = state.form
    if (!form || typeof form !== 'object') return { passed: false, detail: 'form missing' }
    for (const key of FORM_SCHEMA_KEYS) {
      if (typeof form[key] !== 'string')
        return { passed: false, detail: `field "${key}" is ${form[key] === null ? 'null' : typeof form[key]}` }
    }
    return { passed: true }
  },
  EMAIL_FORMAT: (state) => {
    const email = state.form?.email
    if (typeof email !== 'string') return { passed: false, detail: 'email not a string' }
    if (email === '') return { passed: true }
    return EMAIL_RE.test(email) ? { passed: true } : { passed: false, detail: 'bad email' }
  },
  SCHEMA_KEYS: (state) => {
    const form = state.form
    if (!form) return { passed: false, detail: 'form missing' }
    const keys = Object.keys(form).sort()
    const expected = [...FORM_SCHEMA_KEYS].sort()
    if (JSON.stringify(keys) !== JSON.stringify(expected))
      return { passed: false, detail: `keys [${keys}] != [${expected}]` }
    return { passed: true }
  },
  CONTROL_CHARS: (state) => {
    const form = state.form
    if (!form) return { passed: false, detail: 'form missing' }
    for (const key of FORM_SCHEMA_KEYS) {
      if (typeof form[key] === 'string' && CONTROL_CHARS_RE.test(form[key]))
        return { passed: false, detail: `field "${key}" has control chars` }
    }
    return { passed: true }
  }
}

function checkInvariants(state) {
  return Object.entries(INVARIANTS).map(([name, fn]) => {
    try {
      const r = fn(state)
      return { name, passed: r.passed, detail: r.detail }
    } catch (e) {
      return { name, passed: false, detail: `checker threw: ${e.message}` }
    }
  })
}

function verifyCertificate(cert, actualPostState) {
  const reasons = []
  if (!cert || typeof cert !== 'object') return { valid: false, reasons: ['not an object'] }

  const { certificateHash, ...body } = cert
  if (typeof certificateHash !== 'string') reasons.push('certificateHash missing')
  else if (djb2(canonicalJson(body)) !== certificateHash)
    reasons.push('certificateHash does not match certificate body (tampered?)')

  if (!Array.isArray(cert.invariants) || cert.invariants.length === 0)
    reasons.push('certificate records no invariant results')
  else {
    const failed = cert.invariants.filter((i) => !i.passed)
    if (failed.length)
      reasons.push(`invariants failed: ${failed.map((f) => `${f.name}${f.detail ? `(${f.detail})` : ''}`).join(', ')}`)
  }

  if (cert.verified !== true) reasons.push('certificate was issued with verified!=true')

  if (typeof cert.lossWindowMs !== 'number' || cert.lossWindowMs < 0)
    reasons.push('lossWindowMs missing or negative')

  if (actualPostState !== undefined) {
    if (hashState(actualPostState) !== cert.postStateHash)
      reasons.push('postStateHash does not match the provided state')
    const bad = checkInvariants(actualPostState).filter((r) => !r.passed)
    if (bad.length) reasons.push(`re-run invariants failed: ${bad.map((b) => b.name).join(', ')}`)
  }

  return { valid: reasons.length === 0, reasons }
}

// --- CLI ---
const args = process.argv.slice(2)
if (args.length === 0) {
  console.log(`Machine-checkable recovery certificate verifier

Usage:
  node scripts/verify-certificates.mjs <certificates.json> [--state <postState.json>]

Options:
  --state <file>   also re-hash the actual restored state and re-run invariants

Export certificates from the dashboard ("Export JSON") or from code via
exportCertificates() in src/core/Certificate.ts.`)
  process.exit(2)
}

const file = resolve(args[0])
const stateIdx = args.indexOf('--state')
const stateFile = stateIdx !== -1 ? resolve(args[stateIdx + 1]) : null

let certs
try {
  const parsed = JSON.parse(readFileSync(file, 'utf8'))
  certs = Array.isArray(parsed) ? parsed : [parsed]
} catch (e) {
  console.error(`✗ Cannot read certificates from ${file}: ${e.message}`)
  process.exit(1)
}

const state = stateFile ? JSON.parse(readFileSync(stateFile, 'utf8')) : undefined

let allValid = true
for (const cert of certs) {
  const { valid, reasons } = verifyCertificate(cert, state)
  const label = cert?.id ?? '<unknown>'
  if (valid) {
    console.log(`✓ ${label}  class=${cert.errorClass}  lossWindow=${cert.lossWindowMs}ms  restore=${cert.recoveryDurationMs}ms`)
  } else {
    allValid = false
    console.log(`✗ ${label}`)
    for (const r of reasons) console.log(`    - ${r}`)
  }
}

console.log(allValid ? `\nAll ${certs.length} certificate(s) VERIFIED.` : `\nFAILED: some certificates did not verify.`)
process.exit(allValid ? 0 : 1)
