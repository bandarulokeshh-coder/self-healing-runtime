import { create } from 'zustand'
import type { ErrorClass } from './ErrorDetector'

interface RecoveryState {
  isRecovering: boolean
  lastRecoveredState: any
  recoveryCount: number
}

interface RecoveryStore extends RecoveryState {
  setIsRecovering: (recovering: boolean) => void
  setRecoveredState: (state: any) => void
  incrementRecoveryCount: () => void
  autoRecovery: boolean
  setAutoRecovery: (enabled: boolean) => void
  lastError?: { errorClass: ErrorClass; message: string; timestamp: number }
  setLastError: (error: { errorClass: ErrorClass; message: string; timestamp: number } | null) => void
  lastRecoveryTime?: number
  setLastRecoveryTime: (time: number) => void
}

const useRecoveryStore = create<RecoveryStore>((set) => ({
  isRecovering: false,
  lastRecoveredState: null,
  recoveryCount: 0,
  autoRecovery: false,
  lastError: undefined,
  lastRecoveryTime: undefined,
  setAutoRecovery: (enabled) => set({ autoRecovery: enabled }),
  setIsRecovering: (recovering) => set({ isRecovering: recovering }),
  setRecoveredState: (state) => set({ lastRecoveredState: state }),
  incrementRecoveryCount: () =>
    set((state) => ({
      recoveryCount: state.recoveryCount + 1,
      lastRecoveryTime: Date.now()
    })),
  setLastError: (error) => set({ lastError: error || undefined }),
  setLastRecoveryTime: (time) => set({ lastRecoveryTime: time })
}))

export { useRecoveryStore }
