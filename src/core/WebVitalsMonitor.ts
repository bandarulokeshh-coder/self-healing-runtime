import { create } from 'zustand'
import { useDiagnosisStore } from './DiagnosisStore'
import { useRecoveryStore } from './RecoveryStore'
import type { WebVitalMetric } from '../types'

type MetricHandler = (metric: WebVitalMetric) => void

const getCLS: (onReport: MetricHandler) => () => void = (onReport) => {
  let clsValue = 0
  try {
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        const shiftEntry = entry as any
        if (!shiftEntry.hadRecentInput) {
          clsValue += shiftEntry.value
          onReport({
            name: 'CLS',
            value: clsValue,
            delta: shiftEntry.value,
            id: shiftEntry.entryType + '-' + Date.now(),
            entries: [shiftEntry],
            startTime: shiftEntry.startTime
          })
        }
      }
    })
    observer.observe({ type: 'layout-shift', buffered: true })
    return () => observer.disconnect()
  } catch (e) {
    // PerformanceObserver not supported
    return () => {}
  }
}

const getFID: (onReport: MetricHandler) => () => void = (onReport) => {
  try {
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        const eventEntry = entry as any
        onReport({
          name: 'FID',
          value: eventEntry.processingStart - eventEntry.startTime,
          delta: eventEntry.processingStart - eventEntry.startTime,
          id: eventEntry.entryType + '-' + Date.now(),
          entries: [eventEntry],
          startTime: eventEntry.startTime
        })
      }
    })
    observer.observe({ type: 'first-input', buffered: true })
    return () => observer.disconnect()
  } catch (e) {
    // PerformanceObserver not supported
    return () => {}
  }
}

const getLCP: (onReport: MetricHandler) => () => void = (onReport) => {
  try {
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        onReport({
          name: 'LCP',
          value: entry.startTime,
          delta: entry.startTime,
          id: entry.entryType + '-' + Date.now(),
          entries: [entry],
          startTime: entry.startTime
        })
      }
    })
    observer.observe({ type: 'largest-contentful-paint', buffered: true })
    return () => observer.disconnect()
  } catch (e) {
    // PerformanceObserver not supported
    return () => {}
  }
}

const VITALS_THRESHOLDS = {
  LCP: 2500,
  FID: 100,
  CLS: 0.1,
  TTFB: 800
}

const VITALS_PREVENTIVE_ACTIONS = {
  LCP: [
    'Optimize and compress images',
    'Use modern image formats (WebP, AVIF)',
    'Implement lazy loading for below-the-fold content',
    'Optimize CSS delivery and reduce render-blocking resources',
    'Use CDN for static assets',
    'Consider server-side rendering or static generation'
  ],
  FID: [
    'Minimize JavaScript execution time',
    'Break up long-running JavaScript tasks',
    'Use web workers for background processing',
    'Reduce third-party script impact',
    'Optimize event handlers and callbacks',
    'Consider using requestIdleCallback for low-priority work'
  ],
  CLS: [
    'Include size attributes on images and videos',
    'Reserve space for ad elements and embeds',
    'Avoid inserting content above existing content',
    'Use transform animations instead of layout-changing properties',
    'Load web fonts efficiently to prevent FOIT/FOUT',
    'Ensure fallback fonts similar size to web fonts'
  ],
  TTFB: [
    'Optimize server response time',
    'Use caching strategies (CDN, browser, server-side)',
    'Optimize database queries and API responses',
    'Reduce redirect chains',
    'Use HTTP/2 or HTTP/3 protocols',
    'Consider edge computing or serverless functions'
  ]
}

let vitalsUnsubscribers: (() => void)[] = []
let vitalsReadInterval: ReturnType<typeof setInterval> | null = null

// Poll browser performance entries and record a fresh reading for each metric
const sampleVitalsOnce = () => {
  const store = useWebVitalsStore.getState()

  try {
    // @ts-ignore - FID/first-input API is deprecated but still available
    const navEntries = performance.getEntriesByType('navigation') as PerformanceNavigationTiming[]
    const nav = navEntries[0]
    if (nav) {
      store.recordVital('ttfb', {
        name: 'TTFB',
        value: nav.responseStart,
        delta: nav.responseStart,
        id: 'nav-' + nav.startTime,
        entries: [nav],
        startTime: nav.startTime
      })
    }
  } catch (e) {
    // Navigation timing not available
  }

  try {
    // @ts-ignore - LCP API deprecated but available
    const lcpEntries = performance.getEntriesByType('largest-contentful-paint')
    const lcpEntry = lcpEntries[lcpEntries.length - 1]
    if (lcpEntry) {
      store.recordVital('lcp', {
        name: 'LCP',
        value: lcpEntry.startTime,
        delta: lcpEntry.startTime,
        id: 'lcp-' + lcpEntry.startTime,
        entries: [lcpEntry],
        startTime: lcpEntry.startTime
      })
    }
  } catch (e) {
    // LCP not available
  }

  try {
    // @ts-ignore - first-input (FID) is deprecated in favor of INP, but polling for backward compatibility
    const fidEntries = performance.getEntriesByType('first-input') as any[]
    const fidEntry = fidEntries[fidEntries.length - 1]
    if (fidEntry) {
      store.recordVital('fid', {
        name: 'FID',
        value: fidEntry.processingStart - fidEntry.startTime,
        delta: fidEntry.processingStart - fidEntry.startTime,
        id: 'fid-' + fidEntry.startTime,
        entries: [fidEntry],
        startTime: fidEntry.startTime
      })
    }
  } catch (e) {
    // FID not available (deprecated in some browsers)
  }

  try {
    // @ts-ignore - layout-shift API deprecated but available
    const shifts = (performance.getEntriesByType('layout-shift') as any[]).filter((e) => !e.hadRecentInput)
    if (shifts.length > 0) {
      const clsValue = shifts.reduce((sum, e) => sum + e.value, 0)
      store.recordVital('cls', {
        name: 'CLS',
        value: clsValue,
        delta: shifts[shifts.length - 1].value,
        id: 'cls-' + Date.now(),
        entries: shifts,
        startTime: shifts[shifts.length - 1].startTime
      })
    }
  } catch (e) {
    // CLS not available
  }
}

const onCLS: MetricHandler = (metric) => {
  useWebVitalsStore.getState().recordVital('cls', metric)
}
const onFID: MetricHandler = (metric) => {
  useWebVitalsStore.getState().recordVital('fid', metric)
}
const onLCP: MetricHandler = (metric) => {
  useWebVitalsStore.getState().recordVital('lcp', metric)
}

interface WebVitalsState {
  lcp: WebVitalMetric | null
  fid: WebVitalMetric | null
  cls: WebVitalMetric | null
  ttfb: WebVitalMetric | null
  lastUpdated: number
  monitoring: boolean
  startMonitoring: () => void
  stopMonitoring: () => void
  recordVital: (type: 'lcp' | 'fid' | 'cls' | 'ttfb', metric: WebVitalMetric) => void
  checkAndTriggerPreventiveActions: () => void
  reset: () => void
}

const useWebVitalsStore = create<WebVitalsState>((set, get) => ({
  lcp: null,
  fid: null,
  cls: null,
  ttfb: null,
  lastUpdated: 0,
  monitoring: false,
  startMonitoring: () => {
    if (get().monitoring) return
    set({ monitoring: true })
    vitalsUnsubscribers.push(getCLS(onCLS), getFID(onFID), getLCP(onLCP))
    sampleVitalsOnce()
    vitalsReadInterval = setInterval(sampleVitalsOnce, 1000)
  },
  stopMonitoring: () => {
    set({ monitoring: false })
    while (vitalsUnsubscribers.length > 0) vitalsUnsubscribers.pop()?.()
    if (vitalsReadInterval) {
      clearInterval(vitalsReadInterval)
      vitalsReadInterval = null
    }
  },
  recordVital: (type, metric) => {
    set(() => ({
      [type]: metric,
      lastUpdated: Date.now()
    }))
    get().checkAndTriggerPreventiveActions()
  },
  checkAndTriggerPreventiveActions: () => {
    const { lcp, fid, cls, ttfb } = get()
    const diagnosisStore = useDiagnosisStore.getState()
    const recoveryStore = useRecoveryStore.getState()
    const issues: string[] = []
    const preventiveActions: string[] = []

    if (lcp && lcp.value > VITALS_THRESHOLDS.LCP) {
      issues.push(`LCP too high: ${lcp.value.toFixed(0)}ms (threshold: ${VITALS_THRESHOLDS.LCP}ms)`)
      preventiveActions.push(...VITALS_PREVENTIVE_ACTIONS.LCP)
    }
    if (fid && fid.value > VITALS_THRESHOLDS.FID) {
      issues.push(`FID too high: ${fid.value.toFixed(0)}ms (threshold: ${VITALS_THRESHOLDS.FID}ms)`)
      preventiveActions.push(...VITALS_PREVENTIVE_ACTIONS.FID)
    }
    if (cls && cls.value > VITALS_THRESHOLDS.CLS) {
      issues.push(`CLS too high: ${cls.value.toFixed(3)} (threshold: ${VITALS_THRESHOLDS.CLS})`)
      preventiveActions.push(...VITALS_PREVENTIVE_ACTIONS.CLS)
    }
    if (ttfb && ttfb.value > VITALS_THRESHOLDS.TTFB) {
      issues.push(`TTFB too high: ${ttfb.value.toFixed(0)}ms (threshold: ${VITALS_THRESHOLDS.TTFB}ms)`)
      preventiveActions.push(...VITALS_PREVENTIVE_ACTIONS.TTFB)
    }

    if (issues.length > 0) {
      const preventiveDiagnosis = {
        error_id: `web-vitals-${Date.now()}`,
        root_cause: `Web Vitals performance issues detected: ${issues.join('; ')}`,
        confidence: 0.8,
        suggested_fix: 'Address the specific web vitals issues listed in preventive actions',
        prevention_tips: [...new Set(preventiveActions)],
        llm_model_used: 'web-vitals-monitor'
      }
      diagnosisStore.addDiagnosis(preventiveDiagnosis)
      recoveryStore.setIsRecovering(true)
      setTimeout(() => {
        recoveryStore.setIsRecovering(false)
      }, 2000)
    }
  },
  reset: () => {
    set({
      lcp: null,
      fid: null,
      cls: null,
      ttfb: null,
      lastUpdated: 0,
      monitoring: false
    })
  }
}))

export { useWebVitalsStore, VITALS_THRESHOLDS }
export type { WebVitalMetric }
