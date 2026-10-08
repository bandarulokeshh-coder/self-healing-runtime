import { useEffect, useState } from 'react'
import { useMultiTabStore } from '../core/MultiTabSync'
import { useSnapshotStore } from '../core/SnapshotManager'

const MultiTabMonitor = () => {
  const {
    currentTabId,
    otherTabs,
    syncSupported,
    isSyncing,
    lastSyncAt,
    initializeSync,
    requestSync,
    recoverFromTab,
    cleanup
  } = useMultiTabStore()
  const logs = useSnapshotStore((state) => state.recoveryLogs)
  const [now, setNow] = useState(Date.now())
  const tabs = Object.values(otherTabs).sort((left, right) => right.lastHeartbeat - left.lastHeartbeat)
  const crashedCount = tabs.filter((tab) => tab.status === 'crashed').length

  useEffect(() => {
    initializeSync()
    return () => cleanup()
  }, [initializeSync, cleanup])

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(interval)
  }, [])

  const getTabAge = (timestamp: number) => Math.max(0, Math.floor((now - timestamp) / 1000))
  const getTabStatusLabel = (status: string, age: number) => {
    if (status === 'crashed') return 'No response'
    if (status === 'idle') return `Quiet · ${age}s`
    return age < 2 ? 'Live' : `Synced · ${age}s`
  }

  return (
    <section className="dashboard-card multi-tab-card" aria-labelledby="multi-tab-heading">
      <div className="component-heading">
        <div className="component-heading-copy">
          <span className="component-icon component-icon-blue" aria-hidden="true">⌘</span>
          <div>
            <h3 id="multi-tab-heading">Browser tabs</h3>
            <p>Sync and recover form state across tabs.</p>
          </div>
        </div>
        <span className={`component-tag ${syncSupported === false ? 'component-tag-unavailable' : ''}`}>
          {syncSupported === false ? 'UNAVAILABLE' : `${tabs.length + 1} ${tabs.length === 0 ? 'TAB' : 'TABS'}`}
        </span>
      </div>

      <div className="tab-sync-toolbar">
        <span className={`tab-connection-state ${syncSupported === false ? 'tab-connection-unavailable' : ''}`}>
          <span className="tab-connection-dot" />
          {syncSupported === false ? 'Browser sync unavailable' : isSyncing ? 'Requesting peer state…' : 'Cross-tab sync ready'}
        </span>
        <button
          type="button"
          className="tab-sync-button"
          onClick={requestSync}
          disabled={syncSupported !== true || isSyncing}
        >
          {isSyncing ? 'Syncing…' : 'Sync now'}
        </button>
      </div>

      <div className="tab-list">
        <div className="tab-row">
          <div className="tab-row-label">
            <span className="tab-status-dot" />
            <span>
              <strong>This tab</strong>
              <small>{currentTabId.slice(-8)}</small>
            </span>
          </div>
          <span className="tab-row-status">Active</span>
        </div>

        {tabs.map((tab) => {
          const age = getTabAge(tab.lastHeartbeat)
          return (
            <div key={tab.tabId} className={`tab-row tab-row-peer tab-row-${tab.status}`}>
              <div className="tab-row-label">
                <span className={`tab-status-dot ${tab.status === 'active' ? 'animate-pulse' : `tab-status-dot-${tab.status}`}`} />
                <span>
                  <strong>{tab.status === 'crashed' ? 'Unresponsive tab' : 'Synced tab'}</strong>
                  <small>{tab.tabId.slice(-8)}</small>
                </span>
              </div>
              <div className="tab-peer-actions">
                <span className={`tab-row-status tab-row-status-${tab.status}`}>
                  {getTabStatusLabel(tab.status, age)}
                </span>
                <button
                  type="button"
                  onClick={() => recoverFromTab(tab.tabId)}
                  className="tab-recover-button"
                  aria-label={`Restore saved state from tab ${tab.tabId.slice(-8)}`}
                >
                  Restore
                </button>
              </div>
            </div>
          )
        })}

        {tabs.length === 0 && (
          <p className="tab-empty">
            Open this page in another tab to sync its latest form state here.
          </p>
        )}

        {crashedCount > 0 && (
          <p className="tab-recovery-hint">
            {crashedCount} tab{crashedCount === 1 ? '' : 's'} stopped sending heartbeats. Restore uses its last synced state.
          </p>
        )}
      </div>

      <div className="tab-sync-footer">
        <span>Heartbeat every 2 seconds · idle after 6s · unresponsive after 20s</span>
        <span>{lastSyncAt ? `Last peer sync ${getTabAge(lastSyncAt)}s ago` : 'Waiting for peer tabs'}</span>
      </div>

      {logs.some((log) => log.message.includes('restored from tab')) && (
        <div className="tab-recovery-note">
          <span aria-hidden="true">✓</span>
          <p>
            <strong>State restored.</strong> The selected tab’s latest synced form is now active here.
          </p>
        </div>
      )}
    </section>
  )
}

export { MultiTabMonitor }
