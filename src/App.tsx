import { useEffect } from 'react'
import { SelfHealingBoundary } from './core/SelfHealingBoundary'
import { useSnapshotStore } from './core/SnapshotManager'
import { useRecoveryStore } from './core/RecoveryStore'
import { useWebVitalsStore } from './core/WebVitalsMonitor'
import { initErrorDetector } from './core/ErrorDetector'
import { RecoveryTimeline } from './components/RecoveryTimeline'
import { TimeTravelDebugger } from './components/TimeTravelDebugger'
import { PerformanceGraphs } from './components/PerformanceGraphs'
import { MultiTabMonitor } from './components/MultiTabMonitor'
import { RealWorldDemos } from './components/RealWorldDemos'
import { CertificatePanel } from './components/CertificatePanel'
import { MultiTabRecovery } from './components/MultiTabRecovery'
import { MetricsDashboard } from './components/MetricsDashboard'
import { AIDiagnosisPanel } from './components/AIDiagnosisPanel'
import { DemoForm } from './demo/DemoForm'
import { ErrorButtons } from './demo/ErrorButtons'

function App() {
  const { snapshots, takeSnapshot } = useSnapshotStore()
  const eventCount = useSnapshotStore((state) => state.recoveryLogs.length)
  const { recoveryCount, isRecovering, lastError } = useRecoveryStore()
  const webVitalsStore = useWebVitalsStore()

  useEffect(() => {
    // Take a state snapshot reading every second
    const interval = setInterval(() => {
      const form = useSnapshotStore.getState().form
      takeSnapshot(form)
    }, 1000)
    takeSnapshot(useSnapshotStore.getState().form)
    return () => clearInterval(interval)
  }, [takeSnapshot])

  useEffect(() => {
    // Disabled Web Vitals monitoring to avoid deprecated API warnings in console
    // webVitalsStore.startMonitoring()
    // return () => webVitalsStore.stopMonitoring()
  }, [])

  useEffect(() => {
    const dispose = initErrorDetector()
    return dispose
  }, [])

  return (
    <SelfHealingBoundary
      onError={(error, info) => {
        console.log('App caught error:', error, info)
      }}
    >
      {/* New: Live Metrics Dashboard */}
      <MetricsDashboard />

      {/* AI Diagnosis Panel disabled for cleaner demo */}

      <div className="dashboard-shell min-h-screen">
        <header className="dashboard-topbar">
          <div className="dashboard-topbar-inner">
            <a href="#overview" className="brand-lockup" aria-label="Self-Healing Runtime home">
              <span className="brand-mark" aria-hidden="true">S</span>
              <span className="brand-name">steady<span>runtime</span></span>
            </a>

            <nav className="dashboard-nav" aria-label="Main navigation">
              <a href="#overview" className="dashboard-nav-link dashboard-nav-link-active">Overview</a>
              <a href="#demo" className="dashboard-nav-link">Recovery demo</a>
              <a href="#checkpoints" className="dashboard-nav-link">Time travel</a>
              <a href="#activity" className="dashboard-nav-link">Activity</a>
            </nav>

            <div className={`runtime-indicator ${isRecovering ? 'runtime-indicator-recovering' : ''}`}>
              <span className="runtime-indicator-dot" />
              {isRecovering ? 'Recovering' : 'Runtime healthy'}
            </div>
          </div>
        </header>

        <main id="overview" className="dashboard-main">
          <section className="hero-panel">
            <div className="hero-copy">
              <div className="hero-eyebrow">
                <span className="hero-eyebrow-dot" />
                CLIENT-SIDE RESILIENCE DEMO
              </div>
              <h1>A steadier place for your UI to land.</h1>
              <p>
                Explore how snapshots, recovery controls, and live signals can help an
                application bounce back when something goes wrong.
              </p>
              <a href="#demo" className="hero-action">
                Explore the recovery demo <span aria-hidden="true">↘</span>
              </a>
            </div>

            <div className="hero-status-card">
              <div className="hero-status-heading">
                <span className="hero-status-icon" aria-hidden="true">↻</span>
                <div>
                  <div className="hero-status-title">Recovery engine</div>
                  <div className="hero-status-caption">Local session monitoring</div>
                </div>
                <span className="hero-status-live">LIVE</span>
              </div>
              <div className="hero-status-divider" />
              <div className="hero-status-footer">
                <span>Latest checkpoint</span>
                <strong>{snapshots.length ? 'Available' : 'Collecting…'}</strong>
              </div>
              <div className="hero-status-track" aria-hidden="true">
                <span style={{ width: `${Math.min((snapshots.length / 50) * 100, 100)}%` }} />
              </div>
              <div className="hero-status-meta">
                <span>{snapshots.length} of 50 checkpoints</span>
                <span>Auto-save · 2 sec</span>
              </div>
            </div>
          </section>

          <section className="overview-metrics" aria-label="Runtime summary">
            <article className="overview-metric">
              <div className="overview-metric-label"><span className="metric-icon metric-icon-violet">↺</span>Recoveries</div>
              <div className="overview-metric-value">{recoveryCount}</div>
              <div className="overview-metric-note">Recovery actions completed</div>
            </article>
            <article className="overview-metric">
              <div className="overview-metric-label"><span className="metric-icon metric-icon-blue">▤</span>Checkpoints</div>
              <div className="overview-metric-value">{snapshots.length}<span className="metric-value-muted"> / 50</span></div>
              <div className="overview-metric-note">Recent states kept in memory</div>
            </article>
            <article className="overview-metric">
              <div className="overview-metric-label"><span className="metric-icon metric-icon-green">⌁</span>Runtime</div>
              <div className={`overview-metric-value overview-metric-status ${isRecovering ? 'is-recovering' : ''}`}>
                {isRecovering ? 'Recovering' : 'Healthy'}
              </div>
              <div className="overview-metric-note">Client-side status</div>
            </article>
            <article className="overview-metric">
              <div className="overview-metric-label"><span className="metric-icon metric-icon-amber">◷</span>Snapshot trigger</div>
              <div className="overview-metric-value">Every 1<span className="metric-value-unit"> sec</span></div>
              <div className="overview-metric-note">Checkpoint each second</div>
            </article>
          </section>

          <section id="demo" className="dashboard-section">
            <div className="section-heading">
              <div>
                <div className="section-eyebrow">TRY IT OUT</div>
                <h2>Recovery playground</h2>
                <p>Make a change, then explore how the runtime responds.</p>
              </div>
              <span className="section-caption"><span className="section-caption-dot" /> Changes are saved locally</span>
            </div>

            <div className="playground-grid">
              <div className="playground-main">
                <DemoForm />
                <ErrorButtons />
              </div>
              <aside className="playground-aside" aria-label="Runtime activity">
                <MultiTabMonitor />
                <div className="aside-note">
                  <span className="aside-note-icon" aria-hidden="true">i</span>
                  <p>This is a local demo. Recovery checkpoints stay in this browser session.</p>
                </div>
              </aside>
            </div>
          </section>

          <section id="checkpoints" className="dashboard-section dashboard-section-spaced">
            <div className="section-heading">
              <div>
                <div className="section-eyebrow">TIME-TRAVEL DEBUGGING</div>
                <h2>Browse your checkpoints</h2>
                <p>Review saved form versions and jump back to any point in the session.</p>
              </div>
              <span className="section-caption">Up to 50 recent versions</span>
            </div>
            <TimeTravelDebugger />
          </section>

          <section id="multi-tab-recovery" className="dashboard-section dashboard-section-spaced">
            <div className="section-heading">
              <div>
                <div className="section-eyebrow">MULTI-TAB RECOVERY</div>
                <h2>Recoveries from other tabs</h2>
                <p>Cross-tab restores with their own verified certificates.</p>
              </div>
              <span className="section-caption">MULTI_TAB class</span>
            </div>
            <MultiTabRecovery />
          </section>

          <section className="dashboard-section dashboard-section-spaced">
            <div className="section-heading">
              <div>
                <div className="section-eyebrow">HEALTH SIGNALS</div>
                <h2>Performance at a glance</h2>
                <p>Browser Web Vitals collected while this page is open.</p>
              </div>
              <span className="section-caption"><span className="section-caption-dot" /> Monitoring active</span>
            </div>
            <PerformanceGraphs />
          </section>

          <section className="dashboard-section dashboard-section-spaced">
            <RealWorldDemos />
          </section>

          <section className="dashboard-section dashboard-section-spaced">
            <CertificatePanel />
          </section>

          <section id="activity" className="dashboard-section dashboard-section-spaced dashboard-section-last">
            <div className="section-heading">
              <div>
                <div className="section-eyebrow">SESSION HISTORY</div>
                <h2>Recovery activity</h2>
                <p>A running log of checkpoints and recovery events.</p>
              </div>
              <span className="section-caption">{eventCount} events</span>
            </div>
            <RecoveryTimeline />
          </section>
        </main>

        <footer className="dashboard-footer">
          <div className="dashboard-footer-inner">
            <a href="#overview" className="brand-lockup brand-lockup-footer">
              <span className="brand-mark brand-mark-small" aria-hidden="true">S</span>
              <span className="brand-name">steady<span>runtime</span></span>
            </a>
            <span>Self-Healing Runtime <span className="footer-divider">·</span> Client-side resilience demo</span>
          </div>
        </footer>
      </div>
    </SelfHealingBoundary>
  )
}

export default App
