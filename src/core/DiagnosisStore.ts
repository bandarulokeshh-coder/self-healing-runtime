import { create } from 'zustand'
import type { Diagnosis } from '../types'

interface DiagnosisStore {
  diagnoses: Diagnosis[]
  currentDiagnosis: Diagnosis | null
  loading: boolean
  addDiagnosis: (diagnosis: Omit<Diagnosis, 'timestamp'>) => void
  setCurrentDiagnosis: (diagnosis: Omit<Diagnosis, 'timestamp'> | null) => void
  clearDiagnoses: () => void
  setLoading: (loading: boolean) => void
}

const useDiagnosisStore = create<DiagnosisStore>((set) => ({
  diagnoses: [],
  currentDiagnosis: null,
  loading: false,
  addDiagnosis: (diagnosis) =>
    set((state) => ({
      diagnoses: [
        ...state.diagnoses,
        {
          ...diagnosis,
          timestamp: Date.now()
        }
      ],
      currentDiagnosis: {
        ...diagnosis,
        timestamp: Date.now()
      }
    })),
  setCurrentDiagnosis: (diagnosis) =>
    set({
      currentDiagnosis: diagnosis
        ? {
            ...diagnosis,
            timestamp: Date.now()
          }
        : null
    }),
  clearDiagnoses: () => ({
    diagnoses: [],
    currentDiagnosis: null
  }),
  setLoading: (loading) => set({ loading })
}))

export { useDiagnosisStore }
