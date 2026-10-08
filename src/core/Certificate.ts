import { create } from 'zustand'
import { checkInvariants, allInvariantsPass, type InvariantResult } from './Invariants'
import type { ErrorClass } from './ErrorDetector'

/**
 * Machine-checkable recovery certificate (see docs/FORMAL_GUARANTEES.md).
 * A certificate proves that a recovery: restored a state hash recorded at
 * issue time, satisfies every invariant in I, and completed within a bounded
 * loss window. Anyone can re-verify with scripts/verify-certificates.mjs.
 */
export interface RecoveryCertificate {
  id: string
  issuedAt: number
  errorClass: ErrorClass
  errorMessage: string
  preStateHash: string
  postStateHash: string
  snapshotId: string
  snapshotTimestamp: number
  lossWindowMs: number
  recoveryDurationMs: number
  restoreDurationMs?: number // Alias for recoveryDurationMs
  invariants: InvariantResult[]
  verified: boolean
  certificateHash: string
}

/** djb2 — deterministic, dependency-free string hash (hex). */
export function djb2(input: string): string {
  let hash = 5381
  for (let i = 0; i < input.length; i++) {
    hash = ((hash << 5) + hash + input.charCodeAt(i)) | 0
  }
  return (hash >>> 0).toString(16).padStart(8, '0')
}

/** Canonical JSON: recursively key-sorted so equal states hash equally.
 *  Matches JSON.stringify semantics (undefined-valued keys are dropped) so
 *  in-memory objects and their serialized round-trips hash identically. */
export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null'
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`
  const obj = value as Record<string, unknown>
  const keys = Object.keys(obj)
    .filter((k) => obj[k] !== undefined)
    .sort()
  return `{${keys.map((k) => `${JSON.stringify(k)}:${canonicalJson(obj[k])}`).join(',')}}`
}

export function hashState(state: unknown): string {
  return djb2(canonicalJson(state))
}

function certificateBody(cert: Omit<RecoveryCertificate, 'certificateHash'>): string {
  return canonicalJson(cert)
}

export interface IssueCertificateInput {
  errorClass: ErrorClass
  errorMessage: string
  preState: unknown
  postState: unknown
  snapshotId: string
  snapshotTimestamp: number
  /** Failure-detection time; when omitted, certificate issue time is used. */
  detectedAt?: number
  recoveryDurationMs: number
}

/** Build + self-sign a certificate: hashes, invariant re-run, verified flag. */
export function issueCertificate(input: IssueCertificateInput): RecoveryCertificate {
  const invariants = checkInvariants(input.postState as Record<string, unknown>)
  const postStateHash = hashState(input.postState)
  const now = Date.now()
  const body: Omit<RecoveryCertificate, 'certificateHash'> = {
    id: `cert-${now}-${Math.random().toString(36).slice(2, 9)}`,
    issuedAt: now,
    errorClass: input.errorClass,
    errorMessage: input.errorMessage.slice(0, 500),
    preStateHash: hashState(input.preState),
    postStateHash,
    snapshotId: input.snapshotId,
    snapshotTimestamp: input.snapshotTimestamp,
    // Delta = age of newest admitted checkpoint AT MOMENT OF FAILURE
    // (Theorem 4: <= T + epsilon); recoveryDuration is tracked separately
    lossWindowMs: Math.max(0, (input.detectedAt ?? now) - input.snapshotTimestamp),
    recoveryDurationMs: Number(input.recoveryDurationMs.toFixed(3)),
    invariants,
    verified: allInvariantsPass(invariants)
  }
  return { ...body, certificateHash: djb2(certificateBody(body)) }
}

export interface VerificationResult {
  valid: boolean
  reasons: string[]
}

/**
 * Verify a certificate without trusting the issuer:
 *  1. certificateHash matches its canonical body (tamper evidence)
 *  2. every recorded invariant passed
 *  3. optional: re-hash the actual restored state and re-run invariants
 */
export function verifyCertificate(
  cert: RecoveryCertificate,
  actualPostState?: unknown
): VerificationResult {
  const reasons: string[] = []

  const { certificateHash, ...body } = cert
  if (djb2(canonicalJson(body)) !== certificateHash)
    reasons.push('certificateHash does not match certificate body (tampered?)')

  const failed = (cert.invariants || []).filter((i) => !i.passed)
  if (failed.length) reasons.push(`invariants failed: ${failed.map((f) => `${f.name}(${f.detail ?? ''})`).join(', ')}`)
  if (!cert.verified) reasons.push('certificate was issued with verified=false')
  if ((cert.invariants || []).length === 0) reasons.push('certificate records no invariant results')

  if (actualPostState !== undefined) {
    if (hashState(actualPostState) !== cert.postStateHash)
      reasons.push('postStateHash does not match the provided state')
    const rerun = checkInvariants(actualPostState as Record<string, unknown>)
    const bad = rerun.filter((r) => !r.passed)
    if (bad.length) reasons.push(`re-run invariants failed: ${bad.map((b) => b.name).join(', ')}`)
  }

  return { valid: reasons.length === 0, reasons }
}

interface CertificateStore {
  certificates: RecoveryCertificate[]
  addCertificate: (cert: RecoveryCertificate) => void
  clear: () => void
}

export const useCertificateStore = create<CertificateStore>((set) => ({
  certificates: [],
  addCertificate: (cert) => set((s) => ({ certificates: [...s.certificates, cert] })),
  clear: () => set({ certificates: [] })
}))

export const exportCertificates = (): string =>
  JSON.stringify(useCertificateStore.getState().certificates, null, 2)
