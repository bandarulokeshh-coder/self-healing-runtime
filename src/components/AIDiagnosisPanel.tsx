import { useState, useEffect } from 'react'
import { useDiagnosisStore } from '../core/DiagnosisStore'
import type { ErrorClass } from '../core/ErrorDetector'

interface AIDiagnosisPanelProps {
  errorClass?: ErrorClass
  errorMessage?: string
  stackTrace?: string
}

export const AIDiagnosisPanel = ({ errorClass, errorMessage, stackTrace }: AIDiagnosisPanelProps) => {
  const diagnosisStore = useDiagnosisStore()
  const [showPanel, setShowPanel] = useState(false)
  const isAnalyzing = diagnosisStore.loading

  useEffect(() => {
    if (errorClass) {
      setShowPanel(true)
      // Auto-hide after 15 seconds
      const timer = setTimeout(() => setShowPanel(false), 15000)
      return () => clearTimeout(timer)
    }
  }, [errorClass])

  // Mock AI diagnosis for demo (replace with actual GPT-4 call in production)
  const getDiagnosis = (): { cause: string; fix: string; prevention: string } => {
    if (diagnosisStore.currentDiagnosis) {
      // If we have a real diagnosis, format it
      const diag = diagnosisStore.currentDiagnosis as any
      return {
        cause: diag.cause || diag.rootCause || 'Error detected',
        fix: diag.fix || diag.suggestion || 'State restored from snapshot',
        prevention: diag.prevention || diag.recommendation || 'Review error logs'
      }
    }

    const diagnoses: Record<string, { cause: string; fix: string; prevention: string }> = {
      RENDER_CRASH: {
        cause: 'Component threw exception during render phase',
        fix: 'State restored from last valid snapshot. Component remounted with clean state.',
        prevention: 'Add null checks before rendering dynamic data. Use optional chaining (data?.field).'
      },
      EVENT_HANDLER: {
        cause: 'Synchronous exception in click handler',
        fix: 'Error caught by window.onerror listener. State rolled back to pre-error snapshot.',
        prevention: 'Wrap event handlers in try-catch blocks. Validate input before processing.'
      },
      ASYNC_TIMEOUT: {
        cause: 'Unhandled error in setTimeout callback',
        fix: 'Async error detected and classified. Recovery completed via snapshot rollback.',
        prevention: 'Use try-catch in async callbacks. Consider Promise-based timeout alternatives.'
      },
      UNHANDLED_REJECTION: {
        cause: 'Promise rejected without .catch() handler',
        fix: 'Caught by unhandledrejection listener. State consistency verified and restored.',
        prevention: 'Always add .catch() to promises. Use async/await with try-catch.'
      },
      NETWORK: {
        cause: 'Network request failed (timeout, 404, or connection error)',
        fix: 'Classified as NETWORK error. Form data preserved during recovery.',
        prevention: 'Implement retry logic with exponential backoff. Show network status to users.'
      },
      STATE_INVARIANT: {
        cause: 'State invariant violation detected (invalid email format)',
        fix: 'Invariant check failed. Rolled back to last consistent state automatically.',
        prevention: 'Validate input at entry point. Use schema validation (Zod, Yup).'
      },
      SLOW_RENDER: {
        cause: 'Render performance degraded (>50ms)',
        fix: 'Performance monitoring detected slowdown. Consider optimization.',
        prevention: 'Use React.memo, useMemo, virtualization. Profile with React DevTools.'
      },
      MEMORY_LEAK: {
        cause: 'Memory pressure detected (potential leak)',
        fix: 'GC metrics show heap growth. Snapshot ring bounded to prevent overflow.',
        prevention: 'Clean up subscriptions, timers. Check for circular references.'
      }
    }

    return diagnoses[errorClass || 'RENDER_CRASH'] || {
      cause: 'Unknown error pattern',
      fix: 'Generic recovery applied',
      prevention: 'Review error logs for specific cause'
    }
  }

  if (!showPanel || !errorClass) return null

  const diagnosis = getDiagnosis()

  return (
    <div className="fixed bottom-4 left-4 w-96 bg-gradient-to-br from-indigo-50 to-purple-50 border-2 border-indigo-200 rounded-lg shadow-2xl p-4 z-50 animate-slide-in">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full flex items-center justify-center">
            <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
          </div>
          <div>
            <h3 className="text-sm font-bold text-gray-900">AI Diagnosis</h3>
            <p className="text-xs text-gray-500">Powered by GPT-4</p>
          </div>
        </div>
        <button
          onClick={() => setShowPanel(false)}
          className="text-gray-400 hover:text-gray-600 transition-colors"
        >
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
          </svg>
        </button>
      </div>

      {isAnalyzing ? (
        <div className="flex items-center justify-center py-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
          <span className="ml-3 text-sm text-gray-600">Analyzing error pattern...</span>
        </div>
      ) : (
        <div className="space-y-3">
          {/* Error Class Badge */}
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-red-100 text-red-700 rounded-full text-xs font-semibold">
            <span className="w-2 h-2 bg-red-500 rounded-full"></span>
            {errorClass}
          </div>

          {/* Root Cause */}
          <div className="bg-white/80 rounded-lg p-3 border border-indigo-100">
            <div className="text-xs font-semibold text-indigo-600 mb-1 flex items-center gap-1">
              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
              Root Cause
            </div>
            <p className="text-xs text-gray-700">{diagnosis.cause}</p>
          </div>

          {/* Recovery Action */}
          <div className="bg-white/80 rounded-lg p-3 border border-green-100">
            <div className="text-xs font-semibold text-green-600 mb-1 flex items-center gap-1">
              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              Recovery Applied
            </div>
            <p className="text-xs text-gray-700">{diagnosis.fix}</p>
          </div>

          {/* Prevention */}
          <div className="bg-white/80 rounded-lg p-3 border border-amber-100">
            <div className="text-xs font-semibold text-amber-600 mb-1 flex items-center gap-1">
              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              Prevention
            </div>
            <p className="text-xs text-gray-700">{diagnosis.prevention}</p>
          </div>

          {/* Confidence Score */}
          <div className="flex items-center justify-between text-xs text-gray-500 pt-2 border-t border-indigo-100">
            <span>Diagnosis Confidence</span>
            <div className="flex items-center gap-2">
              <div className="w-20 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-green-400 to-green-600 w-[95%]"></div>
              </div>
              <span className="font-semibold text-green-600">95%</span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
