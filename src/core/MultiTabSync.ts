import { create } from 'zustand'
import { useSnapshotStore } from './SnapshotManager'
import { issueCertificate, useCertificateStore } from './Certificate'
import type { TabInfo } from '../types'

const CHANNEL_NAME = 'self-healing-sync'
const generateTabId = () => `tab-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

let heartbeatInterval: ReturnType<typeof setInterval> | null = null
let detectionInterval: ReturnType<typeof setInterval> | null = null
let syncCompleteTimeout: ReturnType<typeof setTimeout> | null = null
let beforeUnloadHandler: (() => void) | null = null

interface MultiTabState {
  currentTabId: string
  otherTabs: Record<string, TabInfo>
  channel: BroadcastChannel | null
  syncSupported: boolean | null
  isSyncing: boolean
  lastSyncAt: number | null
  initializeSync: () => void
  sendHeartbeat: () => void
  requestSync: () => void
  detectDeadTabs: () => void
  recoverFromTab: (tabId: string) => void
  cleanup: () => void
}

const useMultiTabStore = create<MultiTabState>((set, get) => ({
  currentTabId: generateTabId(),
  otherTabs: {},
  channel: null,
  syncSupported: null,
  isSyncing: false,
  lastSyncAt: null,
  initializeSync: () => {
    if (get().channel) return

    if (typeof BroadcastChannel === 'undefined') {
      set({ syncSupported: false })
      console.warn('BroadcastChannel not supported in this browser')
      return
    }

    const channel = new BroadcastChannel(CHANNEL_NAME)
    const { currentTabId } = get()

    channel.onmessage = (event: MessageEvent) => {
      const { type, tabId, state: msgState, timestamp } = event.data
      if (tabId === currentTabId) return

      switch (type) {
        case 'HEARTBEAT':
          set((prevState) => ({
            otherTabs: {
              ...prevState.otherTabs,
              [tabId]: {
                tabId,
                lastHeartbeat: timestamp,
                state: msgState,
                status: 'active'
              }
            },
            isSyncing: false,
            lastSyncAt: timestamp
          }))
          if (syncCompleteTimeout !== null) {
            clearTimeout(syncCompleteTimeout)
            syncCompleteTimeout = null
          }
          break
        case 'REQUEST_STATE':
          get().sendHeartbeat()
          break
        case 'TAB_CLOSING':
          set((prevState) => {
            const { [tabId]: _removed, ...remainingTabs } = prevState.otherTabs
            return { otherTabs: remainingTabs }
          })
          break
      }
    }

    set({ channel, syncSupported: true })

    channel.postMessage({
      type: 'REQUEST_STATE',
      tabId: currentTabId,
      timestamp: Date.now()
    })

    heartbeatInterval = setInterval(() => {
      get().sendHeartbeat()
    }, 2000)

    detectionInterval = setInterval(() => {
      get().detectDeadTabs()
    }, 5000)

    beforeUnloadHandler = () => get().cleanup()
    window.addEventListener('beforeunload', beforeUnloadHandler)
  },
  sendHeartbeat: () => {
    const { channel, currentTabId } = get()
    if (!channel) return

    const snapshotStore = useSnapshotStore.getState()
    const currentState = {
      form: snapshotStore.form,
      snapshots: snapshotStore.snapshots,
      recoveryCount: snapshotStore.snapshots.length
    }

    channel.postMessage({
      type: 'HEARTBEAT',
      tabId: currentTabId,
      state: currentState,
      timestamp: Date.now()
    })
  },
  requestSync: () => {
    const { channel } = get()
    if (!channel) return

    set({ isSyncing: true })
    channel.postMessage({
      type: 'REQUEST_STATE',
      tabId: get().currentTabId,
      timestamp: Date.now()
    })

    if (syncCompleteTimeout !== null) clearTimeout(syncCompleteTimeout)
    syncCompleteTimeout = setTimeout(() => {
      set({ isSyncing: false })
      syncCompleteTimeout = null
    }, 1200)
  },
  detectDeadTabs: () => {
    const now = Date.now()
    const IDLE_THRESHOLD = 6000
    const CRASHED_THRESHOLD = 20000
    const { otherTabs } = get()
    const updatedTabs = { ...otherTabs }
    const newlyCrashedTabs: string[] = []
    let changed = false

    Object.entries(otherTabs).forEach(([tabId, info]) => {
      const age = now - info.lastHeartbeat
      const status = age >= CRASHED_THRESHOLD ? 'crashed' : age >= IDLE_THRESHOLD ? 'idle' : 'active'
      if (status === info.status) return

      changed = true
      updatedTabs[tabId] = { ...info, status }
      if (status === 'crashed') newlyCrashedTabs.push(tabId)
    })

    if (changed) set({ otherTabs: updatedTabs })
    newlyCrashedTabs.forEach((tabId) => {
      useSnapshotStore.getState().addLog({
        type: 'error',
        message: `Tab ${tabId.slice(-6)} stopped responding (no heartbeat for 20s)`
      })
      // Multi-tab recovery: automatically restore this tab's last synced state
      // so a crashed/closed tab's work is never lost. Issues a certificate too.
      get().recoverFromTab(tabId)
    })
  },
  recoverFromTab: (tabId: string) => {
    const { otherTabs } = get()
    const sourceTab = otherTabs[tabId]
    if (!sourceTab) {
      useSnapshotStore.getState().addLog({
        type: 'error',
        message: `Cannot restore: browser tab ${tabId.slice(-6)} is no longer available`
      })
      return
    }

    const peerForm = sourceTab.state?.form
    if (!peerForm || typeof peerForm !== 'object' || Array.isArray(peerForm)) {
      useSnapshotStore.getState().addLog({
        type: 'error',
        message: `Cannot restore: browser tab ${tabId.slice(-6)} has no saved form state`
      })
      return
    }

    const snapshotStore = useSnapshotStore.getState()
    const preState = { form: { ...snapshotStore.form } }
    snapshotStore.updateForm(peerForm)
    snapshotStore.addLog({
      type: 'recovery',
      message: `Restoring the latest synced form state from tab ${tabId.slice(-6)}`
    })
    snapshotStore.takeSnapshot(peerForm)
    snapshotStore.addLog({
      type: 'success',
      message: `Form state restored from tab ${tabId.slice(-6)}`
    })

    // Issue a machine-checkable certificate for the cross-tab recovery
    const peerSnapshots = Array.isArray(sourceTab.state?.snapshots) ? sourceTab.state.snapshots : []
    const latestPeerSnapshot = peerSnapshots[peerSnapshots.length - 1]
    const postState = { form: { ...useSnapshotStore.getState().form } }
    const cert = issueCertificate({
      errorClass: 'MULTI_TAB',
      errorMessage: `Tab ${tabId.slice(-6)} became unresponsive`,
      preState,
      postState,
      snapshotId: latestPeerSnapshot?.id ?? 'tab-sync',
      snapshotTimestamp: latestPeerSnapshot?.timestamp ?? sourceTab.lastHeartbeat,
      detectedAt: Date.now(),
      recoveryDurationMs: 0
    })
    useCertificateStore.getState().addCertificate(cert)
    useSnapshotStore.getState().addLog({
      type: 'success',
      message: `Multi-tab recovery certificate ${cert.id} verified=${cert.verified}`
    })
  },
  cleanup: () => {
    const { channel, currentTabId } = get()
    if (heartbeatInterval !== null) {
      clearInterval(heartbeatInterval)
      heartbeatInterval = null
    }
    if (detectionInterval !== null) {
      clearInterval(detectionInterval)
      detectionInterval = null
    }
    if (syncCompleteTimeout !== null) {
      clearTimeout(syncCompleteTimeout)
      syncCompleteTimeout = null
    }
    if (beforeUnloadHandler) {
      window.removeEventListener('beforeunload', beforeUnloadHandler)
      beforeUnloadHandler = null
    }

    if (channel) {
      channel.onmessage = null
      set({ channel: null })
      channel.postMessage({
        type: 'TAB_CLOSING',
        tabId: currentTabId,
        timestamp: Date.now()
      })
      channel.close()
    }
    set({ isSyncing: false })
  }
}))

export { useMultiTabStore }
