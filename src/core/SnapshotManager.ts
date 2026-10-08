import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import type { Snapshot, RecoveryLog, FormData } from '../types'
import { checkInvariants, allInvariantsPass, firstViolation } from './Invariants'
import { reportError } from './ErrorDetector'

const generateId = () => `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

interface SnapshotStore {
  snapshots: Snapshot[]
  recoveryLogs: RecoveryLog[]
  form: FormData
  isSubmitting: boolean
  addSnapshot: (state: any) => void
  getLatestSnapshot: () => Snapshot | null
  addLog: (log: Omit<RecoveryLog, 'id' | 'timestamp'>) => void
  addRecoveryLog: (log: Omit<RecoveryLog, 'id' | 'timestamp'>) => void
  clearLogs: () => void
  takeSnapshot: (form: FormData) => void
  updateForm: (form: Partial<FormData>) => void
  setSubmitting: (isSubmitting: boolean) => void
  restoreSnapshot: (snapshotId: string) => void
  restoreFromSnapshot: () => void
}

const useSnapshotStore = create<SnapshotStore>()(
  immer((set, get) => ({
    snapshots: [],
    recoveryLogs: [],
    form: {
      name: '',
      email: '',
      address: '',
      phone: '',
      message: ''
    },
    isSubmitting: false,
    addSnapshot: (state) =>
      {
        const latestSnapshot = get().getLatestSnapshot()
        if (latestSnapshot && JSON.stringify(latestSnapshot.state) === JSON.stringify(state)) return

        set((draft) => {
          const snapshot: Snapshot = {
            state: JSON.parse(JSON.stringify(state)),
            timestamp: Date.now(),
            id: generateId()
          }
          draft.snapshots.push(snapshot)
          if (draft.snapshots.length > 50) draft.snapshots.shift()
        })
      },
    getLatestSnapshot: () => {
      const snapshots = get().snapshots
      return snapshots.length > 0 ? snapshots[snapshots.length - 1] : null
    },
    addLog: (log) =>
      set((draft) => {
        draft.recoveryLogs.push({
          ...log,
          id: generateId(),
          timestamp: Date.now()
        })
      }),
    addRecoveryLog: (log) => {
      set((draft) => {
        draft.recoveryLogs.push({
          ...log,
          id: generateId(),
          timestamp: Date.now()
        })
      })
    },
    clearLogs: () =>
      set((draft) => {
        draft.recoveryLogs = []
      }),
    takeSnapshot: (form) => {
      const state = { form }
      // Checkpoint integrity rule: never checkpoint a state violating I
      const results = checkInvariants(state as Record<string, unknown>)
      if (!allInvariantsPass(results)) {
        const v = firstViolation(results)!
        get().addLog({
          type: 'error',
          message: `CHECKPOINT REJECTED - invariant ${v.name} violated: ${v.detail}`
        })
        return
      }
      // Log every snapshot attempt in recovery activity, even if the state
      // hash is unchanged — addSnapshot still dedups the actual ring entry.
      get().addSnapshot(state)
      get().addLog({
        type: 'snapshot',
        message: `STATE SNAPSHOT - Size: ${JSON.stringify(state).length} bytes`,
        stateSize: JSON.stringify(state).length
      })
    },
    updateForm: (form) =>
      set((draft) => {
        draft.form = {
          ...draft.form,
          ...form
        }
      }),
    setSubmitting: (isSubmitting) => set({ isSubmitting }),
    restoreSnapshot: (snapshotId) => {
      const snapshot = get().snapshots.find((item) => item.id === snapshotId)
      if (!snapshot) {
        get().addLog({
          type: 'error',
          message: 'Selected checkpoint is no longer available'
        })
        return
      }
      get().addLog({
        type: 'recovery',
        message: `TIME TRAVEL: Restoring checkpoint from ${new Date(snapshot.timestamp).toLocaleTimeString()}`
      })
      set((draft) => {
        const state = snapshot.state
        draft.form = { ...(state?.form ?? state) }
        draft.isSubmitting = false
      })
      get().addLog({
        type: 'success',
        message: `Restored checkpoint from ${new Date(snapshot.timestamp).toLocaleTimeString()}`
      })
    },
    restoreFromSnapshot: () => {
      const snapshot = get().getLatestSnapshot()
      if (!snapshot) {
        get().addLog({
          type: 'error',
          message: 'No snapshot available for recovery'
        })
        return
      }
      get().restoreSnapshot(snapshot.id)
    }
  }))
)

export const takeSnapshot = (state: any) => {
  const store = useSnapshotStore.getState()

  // Checkpoint integrity rule: a state violating I is rejected, reported,
  // and never enters the snapshot ring (Theorem 2 in FORMAL_GUARANTEES.md)
  const results = checkInvariants(state as Record<string, unknown>)
  if (!allInvariantsPass(results)) {
    const v = firstViolation(results)!
    reportError({
      errorClass: 'STATE_INVARIANT',
      message: `Checkpoint rejected - invariant ${v.name} violated: ${v.detail}`,
      source: 'report'
    })
    store.addLog({
      type: 'error',
      message: `CHECKPOINT REJECTED - invariant ${v.name} violated: ${v.detail}`
    })
    return false
  }

  // Always log the snapshot in recovery activity; addSnapshot dedups the ring.
  store.addSnapshot(state)
  const stateSize = JSON.stringify(state).length
  store.addLog({
    type: 'snapshot',
    message: `STATE SNAPSHOT - Size: ${stateSize} bytes`,
    stateSize
  })
  return true
}

export const getLatestSnapshot = () => {
  return useSnapshotStore.getState().getLatestSnapshot()
}

export const addRecoveryLog = (log: Omit<RecoveryLog, 'id' | 'timestamp'>) => {
  useSnapshotStore.getState().addLog(log)
}

export const setSubmitting = (isSubmitting: boolean) =>
  useSnapshotStore.getState().setSubmitting(isSubmitting)

export const restoreFromSnapshot = () =>
  useSnapshotStore.getState().restoreFromSnapshot()

export const getForm = () => useSnapshotStore.getState().form

export { useSnapshotStore }
