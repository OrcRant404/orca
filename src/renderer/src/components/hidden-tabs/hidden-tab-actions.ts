import { useEffect, useState } from 'react'
import { useAppStore } from '@/store'
import {
  setTabHidden,
  workspaceSupportsHiddenTabs
} from '@/store/slices/tabs/tabs-visibility-actions'

export function useHiddenTabsCapability(worktreeId: string) {
  const executionHostId = useAppStore((state) =>
    state.activeWorktreeId === worktreeId
      ? (state.activeWorkspaceExecutionHostId ?? undefined)
      : state.getKnownWorktreeById(worktreeId)?.hostId
  )
  const [supported, setSupported] = useState<boolean | null>(null)
  useEffect(() => {
    let current = true
    setSupported(null)
    void workspaceSupportsHiddenTabs(worktreeId, executionHostId).then(
      (value) => current && setSupported(value),
      () => current && setSupported(false)
    )
    return () => {
      current = false
    }
  }, [executionHostId, worktreeId])
  return supported
}

export async function setTabHiddenAndConfirm(worktreeId: string, tabId: string, hidden: boolean) {
  await setTabHidden(worktreeId, tabId, hidden)
  await new Promise<void>((resolve, reject) => {
    let unsubscribe = () => {}
    const finish = (error?: Error) => {
      clearTimeout(timer)
      unsubscribe()
      if (error) {
        reject(error)
      } else {
        resolve()
      }
    }
    const check = () => {
      const tab = useAppStore
        .getState()
        .unifiedTabsByWorktree[worktreeId]?.find((row) => row.id === tabId)
      if (!tab) {
        finish(new Error('Tab no longer exists'))
      } else if ((tab.isHidden === true) === hidden) {
        finish()
      }
    }
    const timer = setTimeout(
      () => finish(new Error('The host has not confirmed the tab change. Try again.')),
      15_000
    )
    unsubscribe = useAppStore.subscribe(check)
    check()
  })
}
