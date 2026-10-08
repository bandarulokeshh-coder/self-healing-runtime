import { useState } from 'react'
import { reportError, clearActiveError, type ErrorClass } from '../core/ErrorDetector'
import { useSnapshotStore } from '../core/SnapshotManager'

const DEMO_ERRORS: Record<string, { errorClass: ErrorClass; message: string }> = {
  'api-timeout': { errorClass: 'NETWORK', message: 'Simulated API timeout — request exceeded 5000ms' },
  'script': { errorClass: 'SCRIPT_ERROR', message: 'Simulated third-party script exception' },
  'network': { errorClass: 'NETWORK', message: 'Simulated network failure (request failed)' },
  'memory': { errorClass: 'SCRIPT_ERROR', message: 'Simulated memory exhaustion in page script' }
}

interface DemoScenario {
  id: string
  name: string
  description: string
  category: string
  cartValue: string
  fields: number
}

const RealWorldDemos = () => {
  const [activeScenario, setActiveScenario] = useState<string>('ecommerce')
  const [simulateError, setSimulateError] = useState(false)

  const scenarios: DemoScenario[] = [
    {
      id: 'ecommerce',
      name: 'E-commerce Checkout',
      description: '$450 cart — name, email, address, phone, payment',
      category: 'E-commerce',
      cartValue: '$450',
      fields: 6
    },
    {
      id: 'banking',
      name: 'Banking Transfer',
      description: '$5,000 transfer — account number, routing, amount, memo',
      category: 'Banking',
      cartValue: '$5,000',
      fields: 5
    },
    {
      id: 'medical',
      name: 'Medical Records',
      description: '50-field patient intake form — medical history, allergies, medications',
      category: 'Healthcare',
      cartValue: 'N/A',
      fields: 50
    },
    {
      id: 'college',
      name: 'College Application',
      description: '650-word essay + personal info — 15 fields of sensitive data',
      category: 'Education',
      cartValue: 'N/A',
      fields: 15
    }
  ]

  const currentScenario = scenarios.find(s => s.id === activeScenario) || scenarios[0]

  const handleTriggerError = (type: string) => {
    setSimulateError(true)
    setTimeout(() => setSimulateError(false), 1500)

    console.log(`Self-Healing Runtime: Simulating ${type} error`)
    window.dispatchEvent(new CustomEvent('self-healing-demo-error', {
      detail: { type, scenario: activeScenario }
    }))

    // Route through the real detector → boundary → recovery path, so every
    // scenario reliably triggers the self-healing flow. Clearing the active
    // error first keeps the buttons working on repeat clicks (continuous demo).
    const { addRecoveryLog } = useSnapshotStore.getState()
    const mapped = DEMO_ERRORS[type]
    clearActiveError()
    addRecoveryLog({ type: 'error', message: `${mapped.message} (${activeScenario})` })
    reportError({ errorClass: mapped.errorClass, message: mapped.message, source: 'report' })
  }

  return (
    <section className="dashboard-card industry-demo-card" aria-labelledby="industry-heading">
      <div className="component-heading">
        <div className="component-heading-copy">
          <span className="component-icon component-icon-amber" aria-hidden="true">◎</span>
          <div>
            <h3 id="industry-heading">Explore a use case</h3>
            <p>See where reliable recovery can make a difference.</p>
          </div>
        </div>
        <span className="component-tag">USE CASES</span>
      </div>

      <div className="scenario-tabs" role="group" aria-label="Choose an industry demo">
        {scenarios.map((scenario) => (
          <button
            key={scenario.id}
            onClick={() => setActiveScenario(scenario.id)}
            aria-pressed={activeScenario === scenario.id}
            className={`scenario-tab ${
              activeScenario === scenario.id
                ? 'scenario-tab-active'
                : ''
            }`}
          >
            <span>{scenario.name}</span>
            <small>{scenario.cartValue}</small>
          </button>
        ))}
      </div>

      <div className="industry-scenario">
        <div className="industry-scenario-top">
          <div>
            <span className="industry-label">{currentScenario?.category}</span>
            <h4>{currentScenario?.name}</h4>
          </div>
          <span className="industry-fields">{currentScenario?.fields} fields to protect</span>
        </div>

        <p className="industry-description">{currentScenario?.description}</p>

        <div className={`industry-preview-grid ${
          currentScenario?.fields > 10 ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1 md:grid-cols-3'
        }`}>
          {Array.from({ length: Math.min(currentScenario?.fields || 5, 6) }).map((_, i) => (
            <div key={i} className="industry-preview-field">
              <span className="industry-preview-check" aria-hidden="true">✓</span>
              Protected field {i + 1}
            </div>
          ))}
          {(currentScenario?.fields || 0) > 6 && (
            <div className="industry-preview-more">
              + {(currentScenario?.fields || 0) - 6} more fields...
            </div>
          )}
        </div>

        <div className="industry-actions">
          {['api-timeout', 'script', 'network', 'memory'].map((type) => (
            <button
              key={type}
              onClick={() => handleTriggerError(type)}
              className="industry-action"
            >
              <span aria-hidden="true">↗</span>{simulateError ? 'Recovering…' : `Simulate ${type}`}
            </button>
          ))}
        </div>
      </div>
    </section>
  )
}

export { RealWorldDemos }
