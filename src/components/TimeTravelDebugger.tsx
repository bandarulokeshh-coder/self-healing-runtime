import { useRef, useState } from 'react'
import { useSnapshotStore } from '../core/SnapshotManager'
import type { Snapshot } from '../types'

const getSnapshotForm = (snapshot: Snapshot): Record<string, unknown> => {
  const state = snapshot.state
  if (state && typeof state === 'object' && 'form' in state && state.form && typeof state.form === 'object') {
    return state.form as Record<string, unknown>
  }
  return state && typeof state === 'object' ? state as Record<string, unknown> : {}
}

const formatTimestamp = (timestamp: number) => new Date(timestamp).toLocaleTimeString([], {
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit'
})

const getRelativeTime = (timestamp: number, now: number) => {
  const seconds = Math.max(0, Math.floor((now - timestamp) / 1000))
  if (seconds < 60) return `${seconds}s ago`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  return `${Math.floor(minutes / 60)}h ago`
}

const areValuesEqual = (left: unknown, right: unknown) => JSON.stringify(left) === JSON.stringify(right)

const TimeTravelDebugger = () => {
  const snapshots = useSnapshotStore((state) => state.snapshots)
  const currentForm = useSnapshotStore((state) => state.form)
  const restoreSnapshot = useSnapshotStore((state) => state.restoreSnapshot)
  const [selectedSnapshotId, setSelectedSnapshotId] = useState<string | null>(null)
  const [compareEnabled, setCompareEnabled] = useState(true)
  const snapshotListRef = useRef<HTMLDivElement>(null)

  const selectedSnapshot = snapshots.find((snapshot) => snapshot.id === selectedSnapshotId) ?? snapshots[snapshots.length - 1] ?? null
  const selectedIndex = selectedSnapshot ? snapshots.findIndex((snapshot) => snapshot.id === selectedSnapshot.id) : -1
  const newestFirstSnapshots = [...snapshots].reverse()
  const previousSnapshot = selectedIndex > 0 ? snapshots[selectedIndex - 1] : null
  const snapshotForm = selectedSnapshot ? getSnapshotForm(selectedSnapshot) : {}
  const previousForm = previousSnapshot ? getSnapshotForm(previousSnapshot) : {}
  const currentFormRecord = currentForm as Record<string, unknown>
  const changedFields = selectedSnapshot
    ? Object.keys({ ...snapshotForm, ...currentFormRecord }).filter((key) => !areValuesEqual(snapshotForm[key], currentFormRecord[key]))
    : []
  const priorChanges = previousSnapshot
    ? Object.keys({ ...previousForm, ...snapshotForm }).filter((key) => !areValuesEqual(previousForm[key], snapshotForm[key]))
    : []

  const changeSelection = (index: number) => {
    const snapshot = snapshots[index]
    if (snapshot) setSelectedSnapshotId(snapshot.id)
  }

  const restoreSelectedSnapshot = () => {
    if (!selectedSnapshot) return
    restoreSnapshot(selectedSnapshot.id)
  }

  return (
    <section className="dashboard-card time-travel-card" aria-labelledby="time-travel-heading">
      <div className="component-heading time-travel-heading">
        <div className="component-heading-copy">
          <span className="component-icon component-icon-violet" aria-hidden="true">↶</span>
          <div>
            <h3 id="time-travel-heading">Time-travel debugger</h3>
            <p>Inspect a saved checkpoint, compare changes, or restore it.</p>
          </div>
        </div>
        <span className="component-tag">{snapshots.length} / 50 CHECKPOINTS</span>
      </div>

      {snapshots.length === 0 ? (
        <div className="time-travel-empty">
          <span className="time-travel-empty-icon" aria-hidden="true">◷</span>
          <strong>Collecting your first checkpoint</strong>
          <p>Change a field in the checkout demo. The runtime saves snapshots automatically.</p>
        </div>
      ) : (
        <div className="time-travel-layout">
          <div className="snapshot-browser">
            <div className="snapshot-browser-header">
              <span>RECENT CHECKPOINTS</span>
              <span>Newest first</span>
            </div>
            <div className="snapshot-list" role="listbox" aria-label="Saved snapshots" ref={snapshotListRef}>
              {newestFirstSnapshots.map((snapshot, listIndex) => {
                const originalIndex = snapshots.findIndex((item) => item.id === snapshot.id)
                const isSelected = selectedSnapshot?.id === snapshot.id
                return (
                  <button
                    key={snapshot.id}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    tabIndex={isSelected ? 0 : -1}
                    className={`snapshot-row ${isSelected ? 'snapshot-row-selected' : ''}`}
                    onClick={() => setSelectedSnapshotId(snapshot.id)}
                    onKeyDown={(event) => {
                      let nextIndex: number | null = null
                      if (event.key === 'ArrowDown') nextIndex = Math.min(listIndex + 1, newestFirstSnapshots.length - 1)
                      if (event.key === 'ArrowUp') nextIndex = Math.max(listIndex - 1, 0)
                      if (event.key === 'Home') nextIndex = 0
                      if (event.key === 'End') nextIndex = newestFirstSnapshots.length - 1
                      if (nextIndex === null) return
                      event.preventDefault()
                      const nextSnapshot = newestFirstSnapshots[nextIndex]
                      setSelectedSnapshotId(nextSnapshot.id)
                      snapshotListRef.current?.querySelectorAll<HTMLButtonElement>('[role="option"]')[nextIndex]?.focus()
                    }}
                  >
                    <span className={`snapshot-marker ${isSelected ? 'snapshot-marker-selected' : ''}`} />
                    <span className="snapshot-row-main">
                      <strong>Checkpoint {originalIndex + 1}</strong>
                      <small>{formatTimestamp(snapshot.timestamp)}</small>
                    </span>
                    <span className="snapshot-row-number">#{originalIndex + 1}</span>
                  </button>
                )
              })}
            </div>
            <div className="snapshot-browser-footer">
              <button
                type="button"
                className="snapshot-step-button"
                disabled={selectedIndex <= 0}
                onClick={() => changeSelection(selectedIndex - 1)}
                aria-label="Select older checkpoint"
              >
                ← Older
              </button>
              <span>{selectedIndex + 1} of {snapshots.length}</span>
              <button
                type="button"
                className="snapshot-step-button"
                disabled={selectedIndex >= snapshots.length - 1}
                onClick={() => changeSelection(selectedIndex + 1)}
                aria-label="Select newer checkpoint"
              >
                Newer →
              </button>
            </div>
          </div>

          {selectedSnapshot && (
            <div className="snapshot-inspector">
              <div className="snapshot-inspector-heading">
                <div>
                  <span className="snapshot-inspector-kicker">SELECTED CHECKPOINT</span>
                  <h4>Checkpoint {selectedIndex + 1}</h4>
                  <p>{formatTimestamp(selectedSnapshot.timestamp)} · {getRelativeTime(selectedSnapshot.timestamp, Date.now())}</p>
                </div>
                <button type="button" onClick={restoreSelectedSnapshot} className="action-primary snapshot-restore-button">
                  <span aria-hidden="true">↶</span> Restore this version
                </button>
              </div>

              <div className="snapshot-compare-bar">
                <div>
                  <strong>Compare changes</strong>
                  <span>{compareEnabled ? 'Selected checkpoint vs current form' : 'Comparison hidden'}</span>
                </div>
                <button
                  type="button"
                  className={`compare-toggle ${compareEnabled ? 'compare-toggle-on' : ''}`}
                  role="switch"
                  aria-checked={compareEnabled}
                  aria-label="Show changes from current form"
                  onClick={() => setCompareEnabled((enabled) => !enabled)}
                >
                  <span />
                </button>
              </div>

              {compareEnabled && (
                <div className="snapshot-diff-summary">
                  {changedFields.length === 0 ? (
                    <span className="snapshot-no-diff">✓ This checkpoint matches the current form.</span>
                  ) : (
                    <>
                      <span className="snapshot-diff-count">{changedFields.length} {changedFields.length === 1 ? 'field' : 'fields'} differ</span>
                      <span className="snapshot-diff-fields">{changedFields.join(', ')}</span>
                    </>
                  )}
                </div>
              )}

              <div className="snapshot-preview-heading">
                <span>FORM STATE</span>
                {previousSnapshot && <span>{priorChanges.length} changes from previous checkpoint</span>}
              </div>
              <div className="snapshot-preview">
                {Object.entries(snapshotForm).length === 0 ? (
                  <p className="snapshot-preview-empty">This checkpoint has no form fields to preview.</p>
                ) : (
                  Object.entries(snapshotForm).map(([key, value]) => (
                    <div key={key} className="snapshot-preview-row">
                      <span>{key}</span>
                      <strong>{typeof value === 'string' ? value || '—' : JSON.stringify(value) ?? '—'}</strong>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  )
}

export { TimeTravelDebugger }
