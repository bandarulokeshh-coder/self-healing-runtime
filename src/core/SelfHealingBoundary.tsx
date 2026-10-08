import { Component, type ErrorInfo, type ReactNode } from 'react'
import { useDiagnosisStore } from './DiagnosisStore'
import { useRecoveryStore } from './RecoveryStore'
import {
  getLatestSnapshot,
  addRecoveryLog,
  restoreFromSnapshot,
  getForm
} from './SnapshotManager'
import {
  useDetectorStore,
  reportError,
  clearActiveError,
  ERROR_CLASS_DESCRIPTIONS,
  type ErrorClass
} from './ErrorDetector'
import { issueCertificate, useCertificateStore } from './Certificate'
import type { Diagnosis } from '../types'

interface Props {
  children: ReactNode
  onError?: (error: Error, errorInfo: ErrorInfo) => void
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
  errorInfo: ErrorInfo | null
  errorClass: ErrorClass | null
  detectedAt: number | null
  diagnosis: Diagnosis | null
  diagnosisLoading: boolean
}

class SelfHealingBoundary extends Component<Props, State> {
  private unsubscribeDetector: (() => void) | null = null

  constructor(props: Props) {
    super(props)
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorClass: null,
      detectedAt: null,
      diagnosis: null,
      diagnosisLoading: false
    }
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return {
      hasError: true,
      error,
      errorInfo: null,
      errorClass: 'RENDER_CRASH',
      detectedAt: Date.now(),
      diagnosis: null,
      diagnosisLoading: false
    }
  }

  /** Non-render error classes (window errors, rejections, network, invariant
   *  violations) arrive through the detector store and open the same card. */
  componentDidMount() {
    this.unsubscribeDetector = useDetectorStore.subscribe((state) => {
      const active = state.activeError
      if (!active) return
      if (this.state.hasError) return
      const err = new Error(active.message)
      this.setState({
        hasError: true,
        error: err,
        errorInfo: null,
        errorClass: active.errorClass,
        detectedAt: active.at,
        diagnosis: null,
        diagnosisLoading: false
      })
      this.sendErrorToBackend(err)
      if (this.props.onError) this.props.onError(err, { componentStack: null })
      this.scheduleAutoRecovery()
    })
  }

  private autoTimer: ReturnType<typeof setTimeout> | null = null

  /** When auto-recovery is enabled, restore the latest checkpoint automatically. */
  private scheduleAutoRecovery() {
    if (!useRecoveryStore.getState().autoRecovery) return
    if (this.autoTimer) clearTimeout(this.autoTimer)
    addRecoveryLog({ type: 'info', message: 'AUTO-RECOVERY armed — restoring checkpoint in 1.2s' })
    this.autoTimer = setTimeout(() => {
      this.autoTimer = null
      if (this.state.hasError) this.handleRecover()
    }, 1200)
  }

  componentWillUnmount() {
    this.unsubscribeDetector?.()
    this.unsubscribeDetector = null
    if (this.autoTimer) clearTimeout(this.autoTimer)
    this.autoTimer = null
  }

  async sendErrorToBackend(error: Error, errorInfo?: ErrorInfo) {
    try {
      const errorEvent = {
        id: `err-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        timestamp: new Date().toISOString(),
        error_type: error.name || 'UnknownError',
        error_message: error.message,
        component_stack: errorInfo?.componentStack || undefined,
        url: window.location.href,
        user_agent: navigator.userAgent,
        recovery_attempted: false,
        recovery_successful: false
      }

      const response = await fetch('http://localhost:8002/api/errors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(errorEvent)
      })

      if (!response.ok) throw new Error(`Backend error: ${response.status}`)

      const savedError = await response.json()
      await this.fetchDiagnosis(savedError.id)
    } catch (err: any) {
      console.error('Failed to send error to backend:', err)
      addRecoveryLog({
        type: 'error',
        message: `BACKEND COMMUNICATION FAILED: ${err.message}`
      })
    }
  }

  async fetchDiagnosis(errorId: string) {
    this.setState({ diagnosisLoading: true })

    const maxAttempts = 10
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        const response = await fetch(`http://localhost:8002/api/diagnoses/${errorId}`)
        if (response.status === 404) {
          await new Promise((resolve) => setTimeout(resolve, 1000))
          continue
        }
        if (!response.ok) throw new Error(`Failed to fetch diagnosis: ${response.status}`)

        const diagnosis: Diagnosis = await response.json()
        this.setState({
          diagnosis,
          diagnosisLoading: false
        })

        addRecoveryLog({
          type: 'success',
          message: `DIAGNOSIS RECEIVED: ${diagnosis.root_cause} (confidence: ${(diagnosis.confidence * 100).toFixed(1)}%)`
        })

        useDiagnosisStore.getState().addDiagnosis({
          error_id: diagnosis.error_id,
          root_cause: diagnosis.root_cause,
          confidence: diagnosis.confidence,
          suggested_fix: diagnosis.suggested_fix,
          prevention_tips: diagnosis.prevention_tips,
          llm_model_used: diagnosis.llm_model_used
        })
        return
      } catch (err: any) {
        console.error('Failed to fetch diagnosis:', err)
        this.setState({ diagnosisLoading: false })
        addRecoveryLog({
          type: 'error',
          message: `DIAGNOSIS FAILED: ${err.message}`
        })
        return
      }
    }

    this.setState({ diagnosisLoading: false })
    addRecoveryLog({
      type: 'error',
      message: 'DIAGNOSIS TIMED OUT: no diagnosis received from backend'
    })
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    addRecoveryLog({
      type: 'error',
      message: `ERROR DETECTED: ${error.message}`,
      errorStack: errorInfo.componentStack || undefined
    })
    this.setState({
      hasError: true,
      error,
      errorInfo,
      errorClass: 'RENDER_CRASH',
      detectedAt: Date.now()
    })
    reportError({
      errorClass: 'RENDER_CRASH',
      message: error.message,
      stack: error.stack,
      source: 'boundary'
    })
    this.sendErrorToBackend(error, errorInfo)
    if (this.props.onError) this.props.onError(error, errorInfo)
    console.error('Self-Healing Runtime caught error:', error, errorInfo)
    this.scheduleAutoRecovery()
  }

  handleRecover = () => {
    const startTime = performance.now()

    const snapshot = getLatestSnapshot()
    if (!snapshot) {
      addRecoveryLog({
        type: 'error',
        message: 'No snapshot available for recovery'
      })
      return
    }

    // pre-state = current (possibly inconsistent) state, post-state = restored
    const preState = { form: { ...getForm() } }
    addRecoveryLog({
      type: 'recovery',
      message: 'RECOVERY EXECUTED - Restoring from checkpoint...'
    })
    restoreFromSnapshot()
    const postState = { form: { ...getForm() } }
    const recoveryDurationMs = performance.now() - startTime

    // Machine-checkable certificate: hashes + re-run invariants on post-state
    const cert = issueCertificate({
      errorClass: this.state.errorClass ?? 'RENDER_CRASH',
      errorMessage: this.state.error?.message ?? 'unknown error',
      preState,
      postState,
      snapshotId: snapshot.id,
      snapshotTimestamp: snapshot.timestamp,
      detectedAt: this.state.detectedAt ?? Date.now(),
      recoveryDurationMs
    })
    useCertificateStore.getState().addCertificate(cert)

    const { setIsRecovering, incrementRecoveryCount } = useRecoveryStore.getState()
    setIsRecovering(true)
    incrementRecoveryCount()

    addRecoveryLog({
      type: 'success',
      message: `✅ RECOVERED - certificate ${cert.id} verified=${cert.verified} | state loss ${cert.lossWindowMs}ms | restore ${recoveryDurationMs.toFixed(1)}ms`,
      recoveryTime: recoveryDurationMs
    })

    clearActiveError()

    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      errorClass: null,
      detectedAt: null,
      diagnosis: null,
      diagnosisLoading: false
    })

    setTimeout(() => {
      setIsRecovering(false)
    }, 500)
  }

  handleReload = () => {
    window.location.reload()
  }

  render() {
    if (this.state.hasError)
      return (
        <div className="error-recovery-ui min-h-screen bg-slate-100 flex items-center justify-center p-6">
          <div className="max-w-2xl w-full bg-white rounded-2xl shadow-xl p-8 border border-red-200">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-12 h-12 bg-red-100 border border-red-200 rounded-xl flex items-center justify-center">
                <span className="text-2xl">⚠️</span>
              </div>
              <div>
                <h1 className="text-2xl font-bold text-slate-900">Runtime Error Detected</h1>
                <p className="text-slate-500 text-sm">Self-healing runtime is ready to recover</p>
                {this.state.errorClass && (
                  <p className="text-xs font-mono text-slate-400 mt-1">
                    class: {this.state.errorClass.replace(/_/g, ' ')}
                    {' — '}
                    {ERROR_CLASS_DESCRIPTIONS[this.state.errorClass]}
                  </p>
                )}
              </div>
            </div>

            <div className="bg-red-50 border border-red-100 p-4 rounded-lg mb-6 font-mono text-sm">
              <div className="text-red-600 font-bold mb-2">Error:</div>
              <div className="text-slate-700">{this.state.error?.message}</div>

              {this.state.errorInfo?.componentStack && (
                <>
                  <div className="text-red-600 font-bold mt-4 mb-2">Stack Trace:</div>
                  <pre className="text-slate-500 text-xs overflow-auto max-h-40">
                    {this.state.errorInfo.componentStack}
                  </pre>
                </>
              )}
            </div>

            {this.state.diagnosisLoading && (
              <div className="bg-indigo-50 border-l-4 border-indigo-500 p-4 mb-4 rounded-r-lg">
                <div className="flex items-center gap-2">
                  <span className="text-xl">🔄</span>
                  <span className="text-indigo-600 font-medium">Getting AI diagnosis...</span>
                </div>
              </div>
            )}

            {!this.state.diagnosisLoading && this.state.diagnosis && (
              <div className="bg-emerald-50 border-l-4 border-emerald-500 p-4 mb-4 rounded-r-lg">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xl">🤖</span>
                  <span className="text-emerald-700 font-bold">AI Diagnosis Complete</span>
                </div>
                <div className="text-emerald-800 text-sm mb-2">
                  <strong>Root Cause:</strong> {this.state.diagnosis.root_cause}
                </div>
                <div className="text-emerald-800 text-sm mb-1">
                  <strong>Confidence:</strong> {(this.state.diagnosis.confidence * 100).toFixed(1)}%
                </div>
                <div className="text-emerald-800 text-sm mb-1">
                  <strong>Suggested Fix:</strong> {this.state.diagnosis.suggested_fix}
                </div>
                {this.state.diagnosis.prevention_tips.length > 0 && (
                  <div className="mt-2">
                    <div className="text-emerald-700 font-semibold text-sm mb-1">Prevention Tips:</div>
                    <ul className="list-disc list-inside text-emerald-800 text-sm space-y-1">
                      {this.state.diagnosis.prevention_tips.map((tip, index) => (
                        <li key={index}>{tip}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {!this.state.diagnosisLoading && !this.state.diagnosis && (
              <div className="bg-amber-50 border-l-4 border-amber-500 p-4 mb-4 rounded-r-lg">
                <div className="flex items-center gap-2">
                  <span className="text-xl">📝</span>
                  <span className="text-amber-700 font-medium">Diagnosis pending...</span>
                </div>
              </div>
            )}

            <div className="flex gap-4">
              <button
                onClick={this.handleRecover}
                className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 px-6 rounded-lg transition-colors"
              >
                🔄 Restore from Checkpoint
              </button>
              <button
                onClick={this.handleReload}
                className="flex-1 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 font-bold py-3 px-6 rounded-lg transition-colors"
              >
                ⟳ Full Reload
              </button>
            </div>

            <div className="mt-6 text-xs text-slate-400 text-center">
              Recovery will restore your data from the last known good state and issue a machine-checkable certificate
            </div>
          </div>
        </div>
      )

    return this.props.children
  }
}

export { SelfHealingBoundary }
