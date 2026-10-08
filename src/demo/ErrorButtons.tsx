import { useState } from 'react'
import { useRecoveryStore } from '../core/RecoveryStore'
import { useSnapshotStore } from '../core/SnapshotManager'
import { reportError } from '../core/ErrorDetector'
import { checkInvariants, firstViolation } from '../core/Invariants'
import { useCertificateStore } from '../core/Certificate'

interface ErrorScenario {
  id: string
  name: string
  description: string
  severity: 'critical' | 'moderate' | 'minor'
}

const ErrorButtons = () => {
  const [isTriggering, setIsTriggering] = useState<string | null>(null)
  const [crashRender, setCrashRender] = useState(false)
  const { isRecovering, recoveryCount, autoRecovery, setAutoRecovery } = useRecoveryStore()
  const { addRecoveryLog, updateForm } = useSnapshotStore()

  const scenarios: ErrorScenario[] = [
    {
      id: 'render-crash',
      name: 'Render Crash',
      description: 'Throws during React render — caught by the error boundary',
      severity: 'critical'
    },
    {
      id: 'event-handler',
      name: 'Event Handler Throw',
      description: 'Synchronous exception inside a click handler',
      severity: 'critical'
    },
    {
      id: 'async-timeout',
      name: 'Async Timeout',
      description: 'Throws from a setTimeout callback (uncaught window error)',
      severity: 'critical'
    },
    {
      id: 'unhandled-rejection',
      name: 'Unhandled Promise',
      description: 'Promise rejection with no catch handler',
      severity: 'critical'
    },
    {
      id: 'network',
      name: 'Network Failure',
      description: 'Real fetch to a dead endpoint (rejection classified as NETWORK)',
      severity: 'critical'
    },
    {
      id: 'state-invariant',
      name: 'State Inconsistency',
      description: 'Corrupts a field so state violates EMAIL_FORMAT',
      severity: 'critical'
    },
    {
      id: 'slow-render',
      name: 'Slow Render',
      description: 'Simulates performance degradation (LCP warning)',
      severity: 'moderate'
    },
    {
      id: 'memory',
      name: 'Memory Leak',
      description: 'Simulates out-of-memory scenario',
      severity: 'moderate'
    }
  ]

  const triggerError = (scenarioId: string) => {
    setIsTriggering(scenarioId)

    switch (scenarioId) {
      // RENDER_CRASH: throws during render → getDerivedStateFromError catches it
      case 'render-crash':
        addRecoveryLog({
          type: 'error',
          message: '💥 RENDER CRASH: component threw during render'
        })
        setTimeout(() => setCrashRender(true), 100)
        break

      // EVENT_HANDLER: real synchronous throw from an event handler →
      // reported with its class first (first-wins), then propagated for real
      case 'event-handler':
        addRecoveryLog({
          type: 'error',
          message: '⚡ EVENT HANDLER: synchronous exception in click handler'
        })
        reportError({
          errorClass: 'EVENT_HANDLER',
          message: 'Simulated event handler exception (click handler)',
          source: 'report'
        })
        throw new Error('Simulated event handler exception (click handler)')

      // ASYNC_TIMEOUT: throw inside setTimeout → window 'error' listener;
      // pre-reported so the on-screen classification is exact
      case 'async-timeout':
        addRecoveryLog({
          type: 'error',
          message: '⚠️ RUNTIME ERROR DETECTED: Uncaught TypeError in timer'
        })
        setTimeout(() => {
          reportError({
            errorClass: 'ASYNC_TIMEOUT',
            message: 'Simulated runtime error from setTimeout - this would crash the app!',
            source: 'report'
          })
          throw new Error('Simulated runtime error from setTimeout - this would crash the app!')
        }, 100)
        break

      // UNHANDLED_REJECTION: real unhandled rejection → window listener
      // classifies it as UNHANDLED_REJECTION
      case 'unhandled-rejection':
        addRecoveryLog({
          type: 'error',
          message: '🔌 UNHANDLED REJECTION: promise rejected with no handler'
        })
        void Promise.reject(new Error('Simulated unhandled promise rejection'))
        break

      // NETWORK: real request to a dead endpoint; the resulting unhandled
      // rejection message ("Failed to fetch") classifies as NETWORK
      case 'network':
        addRecoveryLog({
          type: 'error',
          message: '🔌 NETWORK ERROR: API request failed (connection refused)'
        })
        // dead port (connection refused) -> real unhandled rejection, classified NETWORK
        void fetch('http://localhost:59999/dead-endpoint')
        break

      // STATE_INVARIANT: mutate state, then run the invariant checker;
      // snapshot attempts will also reject this state until it is restored
      case 'state-invariant':
        addRecoveryLog({
          type: 'error',
          message: '⚠️ STATE INCONSISTENCY: corrupting email field (EMAIL_FORMAT)'
        })
        updateForm({ email: 'corrupted@@not-an-email' })
        setTimeout(() => {
          const results = checkInvariants({ form: useSnapshotStore.getState().form })
          const violation = firstViolation(results)
          if (violation) {
            reportError({
              errorClass: 'STATE_INVARIANT',
              message: `Invariant ${violation.name} violated: ${violation.detail}`,
              source: 'report'
            })
          }
        }, 50)
        break

      case 'slow-render':
        addRecoveryLog({
          type: 'error',
          message: '🐌 PERFORMANCE ALERT: Slow render detected (LCP degradation)'
        })
        setTimeout(() => {
          addRecoveryLog({
            type: 'success',
            message: 'Performance auto-optimizing...'
          })
        }, 2000)
        break

      case 'memory':
        addRecoveryLog({
          type: 'error',
          message: 'MemoryWarning: Tab approaching memory limit'
        })
        setTimeout(() => {
          addRecoveryLog({
            type: 'success',
            message: 'Garbage collection triggered, memory freed'
          })
        }, 2500)
        break

      default:
        break
    }

    setTimeout(() => setIsTriggering(null), 3000)
  }

  const exportRecoveryReport = () => {
    const report = {
      generatedAt: new Date().toISOString(),
      recoveryCount,
      autoRecovery,
      form: useSnapshotStore.getState().form,
      snapshots: useSnapshotStore.getState().snapshots,
      recoveryLogs: useSnapshotStore.getState().recoveryLogs,
      certificates: useCertificateStore.getState().certificates
    }
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `recovery-report-${Date.now()}.json`
    a.click()
    URL.revokeObjectURL(url)
    addRecoveryLog({ type: 'success', message: 'Recovery report exported' })
  }

  const handleRecoverAll = () => {
    addRecoveryLog({
      type: 'recovery',
      message: '🔄 Initiating full system recovery...'
    })
    const { incrementRecoveryCount, setIsRecovering } = useRecoveryStore.getState()
    incrementRecoveryCount()
    setIsRecovering(true)
    setTimeout(() => {
      setIsRecovering(false)
      addRecoveryLog({
        type: 'success',
        message: '✅ ALL SYSTEMS RESTORED'
      })
    }, 1000)
  }

  return (
    <section className="dashboard-card error-simulator" aria-labelledby="scenario-heading">
      <div className="component-heading">
        <div className="component-heading-copy">
          <span className="component-icon component-icon-amber" aria-hidden="true">!</span>
          <div>
            <h3 id="scenario-heading">Test a recovery scenario</h3>
            <p>One scenario per error class — each reaches the detector and recovery path for real.</p>
          </div>
        </div>
        <span className="component-tag">{scenarios.length} SCENARIOS</span>
      </div>

      <div className="error-scenario-list">
        {scenarios.map((scenario, index) => (
          <button
            key={scenario.id}
            onClick={() => triggerError(scenario.id)}
            disabled={isTriggering === scenario.id || isRecovering}
            className={`error-scenario ${scenario.severity === 'critical' ? 'error-scenario-critical' : 'error-scenario-moderate'}`}
          >
            <span className="error-scenario-number">{index + 1 < 10 ? `0${index + 1}` : index + 1}</span>
            <span className="error-scenario-copy">
              <strong>{isTriggering === scenario.id ? 'Triggering…' : scenario.name}</strong>
              <span>{scenario.description}</span>
            </span>
            <span className="error-scenario-arrow" aria-hidden="true">↗</span>
          </button>
        ))}
      </div>

      <div className="recovery-controls">
        <button
          onClick={handleRecoverAll}
          disabled={isRecovering}
          className="action-primary recovery-all-button"
        >
          <span aria-hidden="true">↺</span>{isRecovering ? 'Recovering…' : 'Recover all'}
        </button>
        <div className="recovery-controls-meta">
          <span>Recovery #{recoveryCount}</span>
          <span className="recovery-state"><span />{isRecovering ? 'In progress' : 'Ready'}</span>
          <label className="auto-recovery-toggle" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginLeft: 12 }}>
            <input
              type="checkbox"
              checked={autoRecovery}
              onChange={(e) => setAutoRecovery(e.target.checked)}
            />
            Auto-recover
          </label>
          <button type="button" className="action-secondary" style={{ marginLeft: 12 }} onClick={exportRecoveryReport}>
            Export report
          </button>
        </div>
      </div>

      {crashRender && <CrashProbe />}
    </section>
  )
}

/** Throws during render → caught by SelfHealingBoundary (RENDER_CRASH). */
const CrashProbe = () => {
  throw new Error('Simulated React component crash - this would crash the app!')
}

export { ErrorButtons }
