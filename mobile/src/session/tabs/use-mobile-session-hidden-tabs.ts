import { useCallback } from 'react'
import { sessionTabSetHidden } from './mobile-session-tab-write-operations'
import type { MobileSessionTab } from './mobile-session-tabs'

type HiddenTabsScope = {
  client: Parameters<typeof sessionTabSetHidden.request>[0] | null
  worktreeId: string
  hiddenTabsSupported: boolean | null
  sessionTabs: readonly MobileSessionTab[]
}

/** Keep pending writes separate from inventory; the host snapshot is the visibility authority. */
export function useMobileSessionHiddenTabs(scope: HiddenTabsScope) {
  const { client, worktreeId, hiddenTabsSupported, sessionTabs } = scope
  const setSessionTabHidden = useCallback(
    async (tabId: string, hidden: boolean): Promise<{ forwarded: boolean }> => {
      if (!client || hiddenTabsSupported !== true) {
        throw new Error('capability_unsupported')
      }
      const response = await sessionTabSetHidden.request(client, {
        worktree: `id:${worktreeId}`,
        tabId,
        isHidden: hidden
      })
      const reply = sessionTabSetHidden.interpret(response)
      return { forwarded: reply.forwarded }
    },
    [client, worktreeId, hiddenTabsSupported]
  )
  return {
    setSessionTabHidden,
    hiddenSessionTabs: [
      ...new Map(
        sessionTabs
          .filter((tab) => tab.isHidden === true)
          .map((tab) => [tab.type === 'terminal' ? (tab.parentTabId ?? tab.id) : tab.id, tab])
      ).values()
    ]
  }
}
