import { useRef, useEffect } from 'react'
import { useSnapshotStore } from '../core/SnapshotManager'

const RecoveryTimeline = () => {
  const logs = useSnapshotStore((state) => state.recoveryLogs)
  const scrollContainerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const container = scrollContainerRef.current
    if (container) container.scrollTop = container.scrollHeight
  }, [logs])

  const getLogIcon = (type: string) => {
    switch (type) {
      case 'error':
        return '!'
      case 'snapshot':
        return '▤'
      case 'recovery':
        return '↺'
      case 'success':
        return '✓'
      default:
        return 'i'
    }
  }

  const getLogColor = (type: string) => {
    switch (type) {
      case 'error':
        return 'timeline-event-error'
      case 'snapshot':
        return 'timeline-event-snapshot'
      case 'recovery':
        return 'timeline-event-recovery'
      case 'success':
        return 'timeline-event-success'
      default:
        return 'timeline-event-info'
    }
  }

  return (
    <section className="dashboard-card timeline-card" aria-label="Recovery activity events">
      <div
        ref={scrollContainerRef}
        className="timeline-list custom-scrollbar"
      >
        {logs.length === 0 ? (
          <div className="timeline-empty">
            <span className="timeline-empty-icon" aria-hidden="true">⌁</span>
            <strong>No activity yet</strong>
            <p>
              Use the demo controls to create a checkpoint or try a recovery scenario.
            </p>
          </div>
        ) : (
          logs.map((log) => (
            <div
              key={log.id}
              className={`timeline-event ${getLogColor(log.type)}`}
            >
              <span className="timeline-event-icon" aria-hidden="true">{getLogIcon(log.type)}</span>
              <div className="timeline-event-content">
                <div className="timeline-event-message-row">
                  <span className="timeline-event-message">{log.message}</span>
                  {log.recoveryTime !== undefined && (
                    <span className="timeline-event-duration">
                      {log.recoveryTime.toFixed(1)}ms
                    </span>
                  )}
                </div>
                {log.errorStack && (
                  <pre className="timeline-event-stack">
                    {log.errorStack}
                  </pre>
                )}
                <div className="timeline-event-meta">
                  {log.stateSize !== undefined && (
                    <span>State: {log.stateSize} bytes</span>
                  )}
                  <span>{new Date(log.timestamp).toLocaleTimeString()}</span>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </section>
  )
}

export { RecoveryTimeline }
