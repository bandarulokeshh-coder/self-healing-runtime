import { create } from 'zustand'
import type { RecoveryState } from '../types'

interface RecoveryStore extends RecoveryState {
  setIsRecovering: (recovering: boolean) => void
  setRecoveredState: (state: any) => void
  incrementRecoveryCount: () => void
  autoRecovery: boolean
  setAutoRecovery: (enabled: boolean) => void
}

const useRecoveryStore = create<RecoveryStore>((set) => ({
  isRecovering: false,
  lastRecoveredState: null,
  recoveryCount: 0,
  autoRecovery: false,
  setAutoRecovery: (enabled) => set({ autoRecovery: enabled }),
  setIsRecovering: (recovering) => set({ isRecovering: recovering }),
  setRecoveredState: (state) => set({ lastRecoveredState: state }),
  incrementRecoveryCount: () =>
    set((state) => ({ recoveryCount: state.recoveryCount + 1 }))
}))

export { useRecoveryStore }
