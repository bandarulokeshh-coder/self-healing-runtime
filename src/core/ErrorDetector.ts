import { create } from 'zustand'
import { useRecoveryStore } from './RecoveryStore'

export type ErrorClass =
  | 'RENDER_CRASH'
  | 'EVENT_HANDLER'
  | 'ASYNC_TIMEOUT'
  | 'UNHANDLED_REJECTION'
  | 'SCRIPT_ERROR'
  | 'NETWORK'
  | 'STATE_INVARIANT'
  | 'MULTI_TAB'

export const ERROR_CLASSES: ErrorClass[] = [
  'RENDER_CRASH',
  'EVENT_HANDLER',
  'ASYNC_TIMEOUT',
  'UNHANDLED_REJECTION',
  'SCRIPT_ERROR',
  'NETWORK',
  'STATE_INVARIANT',
  'MULTI_TAB'
]

export const ERROR_CLASS_DESCRIPTIONS: Record<ErrorClass, string> = {
  RENDER_CRASH: 'Thrown while React renders a component (caught by the error boundary)',
  EVENT_HANDLER: 'Thrown synchronously inside a UI event handler',
  ASYNC_TIMEOUT: 'Thrown from setTimeout / async timer callback',
  UNHANDLED_REJECTION: 'Promise rejection with no catch handler',
  SCRIPT_ERROR: 'Thrown by third-party or injected script code',
  NETWORK: 'Fetch / resource request failed',
  STATE_INVARIANT: 'Application state violated a consistency invariant',
  MULTI_TAB: 'Form state recovered from another browser tab'
}

export interface DetectedError {
  id: string
  errorClass: ErrorClass
  message: string
  stack?: string
  at: number
  source: 'boundary' | 'window' | 'rejection' | 'report'
}

interface DetectorState {
  activeError: DetectedError | null
  errorHistory: DetectedError[]
  report: (e: Omit<DetectedError, 'id' | 'at'>) => void
  clearActive: () => void
}

let seq = 0
const genId = () => `err-${Date.now()}-${(seq++).toString(36)}`

/**
 * Global error detector store. The SelfHealingBoundary subscribes to
 * `activeError`; whenever any error class is detected, the boundary shows
 * its recovery UI without a page reload.
 */
export const useDetectorStore = create<DetectorState>((set, get) => ({
  activeError: null,
  errorHistory: [],
  report: (e) => {
    // first error wins until the boundary is cleared (stable class on screen)
    if (get().activeError) return
    const detected: DetectedError = { ...e, id: genId(), at: Date.now() }

    // Update RecoveryStore with last error for AI diagnosis
    useRecoveryStore.getState().setLastError({
      errorClass: detected.errorClass,
      message: detected.message,
      timestamp: detected.at
    })

    set((state) => ({
      activeError: detected,
      errorHistory: [...state.errorHistory.slice(-99), detected]
    }))
  },
  clearActive: () => set({ activeError: null })
}))

export const reportError = (e: Omit<DetectedError, 'id' | 'at'>) =>
  useDetectorStore.getState().report(e)

export const clearActiveError = () => useDetectorStore.getState().clearActive()

/** Classify an uncaught window error or unhandled rejection heuristically. */
export function classifyRawError(message: string, stack?: string, kind: 'error' | 'rejection' = 'error'): ErrorClass {
  const m = message.toLowerCase()
  const s = (stack || '').toLowerCase()
  // network-layer failures often arrive as rejections but are their own class
  if (m.includes('network') || m.includes('failed to fetch') || m.includes('load failed') || m.includes('dns') || m.includes('err_unsafe_port') || m.includes('connection refused'))
    return 'NETWORK'
  if (kind === 'rejection') return 'UNHANDLED_REJECTION'
  if (s.includes('injectsafesettimeout') || s.includes('eventhandler') || s.includes('invokeeventhandlers'))
    return 'EVENT_HANDLER'
  if (s.includes('react') && (s.includes('dispatch') || s.includes('event')))
    return 'EVENT_HANDLER'
  return 'SCRIPT_ERROR'
}

let initialized = false

/** Install window-level listeners. Idempotent. */
export function initErrorDetector(): () => void {
  if (initialized || typeof window === 'undefined') return () => {}
  initialized = true

  const onError = (event: ErrorEvent) => {
    const message = event.message || String(event.error || 'Unknown error')
    const stack = event.error?.stack || undefined
    reportError({
      errorClass: classifyRawError(message, stack, 'error'),
      message,
      stack,
      source: 'window'
    })
  }

  const onRejection = (event: PromiseRejectionEvent) => {
    const reason: any = event.reason
    const message = reason?.message || String(reason)
    reportError({
      errorClass: classifyRawError(message, reason?.stack, 'rejection'),
      message,
      stack: reason?.stack,
      source: 'rejection'
    })
  }

  window.addEventListener('error', onError)
  window.addEventListener('unhandledrejection', onRejection)

  return () => {
    window.removeEventListener('error', onError)
    window.removeEventListener('unhandledrejection', onRejection)
    initialized = false
  }
}
