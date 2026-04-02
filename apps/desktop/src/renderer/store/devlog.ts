import { create } from "zustand"

export type DevLogLevel = "info" | "success" | "warn" | "error" | "raw"

export interface DevLogEntry {
  id: string
  timestamp: string
  level: DevLogLevel
  category: string
  message: string
  detail?: string
}

interface DevLogState {
  entries: DevLogEntry[]
  addEntry: (entry: Omit<DevLogEntry, "id" | "timestamp">) => void
  clear: () => void
}

export const useDevLogStore = create<DevLogState>((set) => ({
  entries: [],

  addEntry: (entry) => {
    const newEntry: DevLogEntry = {
      ...entry,
      id: `log-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      timestamp: new Date().toLocaleTimeString("zh-CN", { hour12: false }),
    }
    set((state) => ({
      entries: [...state.entries.slice(-499), newEntry],
    }))
  },

  clear: () => set({ entries: [] }),
}))
