import { useCertificateStore } from '../core/Certificate'
import { useSnapshotStore } from '../core/SnapshotManager'

/** Dedicated panel for cross-tab (MULTI_TAB) recoveries, sectioned like Time Travel. */
const MultiTabRecovery = () => {
  const certificates = useCertificateStore((s) => s.certificates)
  const logs = useSnapshotStore((s) => s.recoveryLogs)

  const tabCerts = certificates.filter((c) => c.errorClass === 'MULTI_TAB')
  const tabLogs = logs.filter(
    (log) =>
      log.message.includes('tab') &&
      (log.message.includes('restored') || log.message.includes('Tab ') || log.message.includes('MULTI_TAB') || log.message.toLowerCase().includes('multi-tab'))
  )

  return (
    <section className="dashboard-card" aria-label="Multi-tab recovery">
      {tabCerts.length === 0 && tabLogs.length === 0 ? (
        <p className="tab-empty">
          No multi-tab recoveries yet. Open the demo in two tabs, then let one tab go unresponsive — this tab restores its last synced state here.
        </p>
      ) : (
        <div className="certificate-list">
          {tabCerts.map((cert) => (
            <article key={cert.id} className="dashboard-card certificate-card">
              <div className="component-heading">
                <div className="component-heading-copy">
                  <span className="component-icon component-icon-blue" aria-hidden="true">⌘</span>
                  <div>
                    <h3>{cert.id}</h3>
                    <p>
                      {cert.errorMessage} · loss window {cert.lossWindowMs}ms · recovery {cert.recoveryDurationMs}ms
                    </p>
                  </div>
                </div>
                <span className={`component-tag ${cert.verified ? 'certificate-verified' : 'certificate-failed'}`}>
                  {cert.verified ? 'VERIFIED' : 'FAILED'}
                </span>
              </div>
              <div className="certificate-hashes">
                <span>snapshot <code>{cert.snapshotId.slice(0, 12)}…</code></span>
                <span>post <code>{cert.postStateHash.slice(0, 8)}…</code></span>
              </div>
            </article>
          ))}
          {tabLogs.filter((l) => l.type !== 'success' || !tabCerts.length).slice(-5).map((log) => (
            <div key={log.id} className="timeline-event timeline-event-recovery">
              <span className="timeline-event-icon" aria-hidden="true">↺</span>
              <div className="timeline-event-content">
                <div className="timeline-event-message-row">
                  <span className="timeline-event-message">{log.message}</span>
                </div>
                <div className="timeline-event-meta">
                  <span>{new Date(log.timestamp).toLocaleTimeString()}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

export { MultiTabRecovery }
