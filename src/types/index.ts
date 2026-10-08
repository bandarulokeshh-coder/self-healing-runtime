export interface FormData {
  name: string
  email: string
  address: string
  phone: string
  message: string
  [key: string]: any
}

export interface Snapshot {
  state: any
  timestamp: number
  id: string
}

export type RecoveryLogType = 'error' | 'snapshot' | 'recovery' | 'success' | 'info'

export interface RecoveryLog {
  type: RecoveryLogType
  message: string
  id: string
  timestamp: number
  stateSize?: number
  recoveryTime?: number
  errorStack?: string
}

export interface Diagnosis {
  error_id: string
  root_cause: string
  confidence: number
  suggested_fix: string
  prevention_tips: string[]
  llm_model_used: string
  timestamp?: number
}

export interface WebVitalMetric {
  name: string
  value: number
  delta: number
  id: string
  entries: any[]
  startTime: number
}

export interface RecoveryState {
  isRecovering: boolean
  lastRecoveredState: any
  recoveryCount: number
}

export type TabStatus = 'active' | 'idle' | 'crashed'

export interface TabInfo {
  tabId: string
  lastHeartbeat: number
  state: any
  status: TabStatus
}
