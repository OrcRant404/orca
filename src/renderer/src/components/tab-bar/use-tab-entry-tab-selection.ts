import { useEffect, useRef, useState } from 'react'
import { activateOpenTabSearchResult } from './open-tab-selection-routing'
import type { OpenTabSearchResult } from './open-tab-search'
import type { TabBarCreateEntryProps } from './tab-create-entry-props'

export function useTabEntryTabSelection({
  onDidOpenEntry,
  onQueueSwitchFocus
}: Pick<TabBarCreateEntryProps, 'onDidOpenEntry' | 'onQueueSwitchFocus'>) {
  const [switchPending, setPending] = useState(false)
  const [switchError, setSwitchError] = useState<string | null>(null)
  const mounted = useRef(true)
  const pending = useRef(false)
  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])
  const selectTab = (result: OpenTabSearchResult) => {
    if (pending.current) {
      return
    }
    pending.current = true
    setPending(true)
    setSwitchError(null)
    void activateOpenTabSearchResult(result)
      .then((outcome) => {
        if (!mounted.current || outcome.status === 'blocked') {
          return
        }
        if (outcome.status === 'failed') {
          setSwitchError(outcome.message)
          return
        }
        if (outcome.focus) {
          onQueueSwitchFocus?.(outcome.focus)
        }
        onDidOpenEntry?.()
      })
      .catch((caught: unknown) => {
        if (mounted.current) {
          setSwitchError(caught instanceof Error ? caught.message : String(caught))
        }
      })
      .finally(() => {
        pending.current = false
        if (mounted.current) {
          setPending(false)
        }
      })
  }
  return { selectTab, switchPending, switchError, setSwitchError }
}
