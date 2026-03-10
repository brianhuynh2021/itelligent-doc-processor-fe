"use client"

import React, { createContext, useCallback, useContext, useMemo, useState } from "react"

export type HeaderSlotName = "center" | "right"

export type HeaderSlotsState = Partial<Record<HeaderSlotName, React.ReactNode>>

interface HeaderSlotsContextValue {
  slots: HeaderSlotsState
  setSlot: (name: HeaderSlotName, node: React.ReactNode) => void
  clearSlot: (name: HeaderSlotName) => void
  clearAll: () => void
}

const HeaderSlotsContext = createContext<HeaderSlotsContextValue | null>(null)

export function HeaderSlotsProvider({ children }: { children: React.ReactNode }) {
  const [slots, setSlots] = useState<HeaderSlotsState>({})

  const setSlot = useCallback((name: HeaderSlotName, node: React.ReactNode) => {
    setSlots((prev) => ({ ...prev, [name]: node }))
  }, [])

  const clearSlot = useCallback((name: HeaderSlotName) => {
    setSlots((prev) => {
      if (!prev[name]) return prev
      const next = { ...prev }
      delete next[name]
      return next
    })
  }, [])

  const clearAll = useCallback(() => setSlots({}), [])

  const value = useMemo<HeaderSlotsContextValue>(
    () => ({ slots, setSlot, clearSlot, clearAll }),
    [slots, setSlot, clearSlot, clearAll]
  )

  return <HeaderSlotsContext.Provider value={value}>{children}</HeaderSlotsContext.Provider>
}

export function useHeaderSlots() {
  const ctx = useContext(HeaderSlotsContext)
  if (!ctx) {
    throw new Error("useHeaderSlots must be used within <HeaderSlotsProvider />")
  }
  return ctx
}

