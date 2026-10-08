export { SelfHealingBoundary } from './SelfHealingBoundary'
export {
  useSnapshotStore,
  takeSnapshot,
  getLatestSnapshot,
  addRecoveryLog,
  restoreFromSnapshot,
  setSubmitting,
  getForm
} from './SnapshotManager'
export { useRecoveryStore } from './RecoveryStore'
export { useDiagnosisStore } from './DiagnosisStore'
export { useWebVitalsStore, VITALS_THRESHOLDS } from './WebVitalsMonitor'
export type { WebVitalMetric } from './WebVitalsMonitor'
export { useMultiTabStore } from './MultiTabSync'

// Detection, invariants, and machine-checkable recovery certificates
export {
  useDetectorStore,
  reportError,
  clearActiveError,
  initErrorDetector,
  classifyRawError,
  ERROR_CLASSES,
  ERROR_CLASS_DESCRIPTIONS
} from './ErrorDetector'
export type { ErrorClass, DetectedError } from './ErrorDetector'

export {
  checkInvariants,
  allInvariantsPass,
  firstViolation,
  STATE_INVARIANTS,
  CHAIN_INVARIANTS,
  FORM_SCHEMA_KEYS
} from './Invariants'
export type { InvariantResult, InvariantDefinition, FormState } from './Invariants'

export {
  useCertificateStore,
  issueCertificate,
  verifyCertificate,
  hashState,
  djb2,
  canonicalJson,
  exportCertificates
} from './Certificate'
export type { RecoveryCertificate, VerificationResult } from './Certificate'
