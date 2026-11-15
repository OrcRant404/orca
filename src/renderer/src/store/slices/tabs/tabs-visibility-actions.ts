import { ORCA_LAYOUT_OWNER_IS_MAIN } from '../../../../../shared/layout-owner-switch'
import { SESSION_TABS_TAB_HIDDEN_RUNTIME_CAPABILITY } from '../../../../../shared/session-tabs-runtime-capabilities'
import { visibleActiveTabId } from '../../../../../shared/workspace-layout/tab-visibility'
import { runtimeEnvironmentIdForWorkspaceOwner } from '@/lib/resolve-owner'
import { parseExecutionHostId, type ExecutionHostId } from '../../../../../shared/execution-host'
import { runtimeEnvironmentCapabilityProof } from '@/runtime/rpc/compatibility/runtime-capability-proof'
import { captureRuntimeEnvironmentCall } from '@/runtime/web-session-tabs-sync/identity/web-runtime-session-environment'
import { resolveHostSessionTabIdForWebSessionTab } from '@/runtime/web-session-tabs-sync/tracking-mappings'
import { toRuntimeWorktreeSelector } from '@/runtime/rpc/targets/runtime-worktree-selector'
import { unwrapRuntimeRpcResult } from '@/runtime/rpc/calls/runtime-rpc-result'
import { sendLayoutApply } from '@/runtime/workspace-layout/commands/layout-apply-send'
import { scheduleRuntimeGraphSync } from '@/runtime/sync-runtime-graph/graph-sync-scheduler'
import type { TabsSlice, TabsSliceGet, TabsSliceSet } from './tabs-slice-contract'
import { buildActiveSurfacePatch } from './tabs-surface'

export async function workspaceSupportsHiddenTabs(
  worktreeId: string,
  executionHostId?: ExecutionHostId
): Promise<boolean> {
  const { useAppStore } = await import('../../index')
  const owner = runtimeEnvironmentIdForWorkspaceOwner(useAppStore.getState(), {
    workspaceId: worktreeId,
    hostId: executionHostId
  })
  if (owner.kind !== 'resolved') {
    return false
  }
  const environmentId = owner.environmentId
  const host = parseExecutionHostId(executionHostId)
  if (host?.kind === 'runtime' && environmentId !== host.environmentId) {
    return false
  }
  return (
    !environmentId ||
    (
      await runtimeEnvironmentCapabilityProof(
        environmentId,
        SESSION_TABS_TAB_HIDDEN_RUNTIME_CAPABILITY
      )
    ).supported
  )
}

export function createTabsVisibilityActions(
  set: TabsSliceSet,
  get: TabsSliceGet
): Pick<TabsSlice, 'setTabHidden' | 'applyTabHidden'> {
  function applyTabHidden(worktreeId: string, tabId: string, isHidden: boolean): void {
    set((state) => {
      const tab = state.unifiedTabsByWorktree[worktreeId]?.find((entry) => entry.id === tabId)
      if (!tab) {
        throw new Error('tab_not_found')
      }
      const tabs = state.unifiedTabsByWorktree[worktreeId].map((entry) =>
        entry.id === tabId ? { ...entry, isHidden } : entry
      )
      const groups = (state.groupsByWorktree[worktreeId] ?? []).map((group) => ({
        ...group,
        activeTabId: visibleActiveTabId(group.tabOrder, group.recentTabIds, group.activeTabId, tabs)
      }))
      const next = {
        unifiedTabsByWorktree: { ...state.unifiedTabsByWorktree, [worktreeId]: tabs },
        groupsByWorktree: { ...state.groupsByWorktree, [worktreeId]: groups },
        ...(tab.contentType === 'terminal'
          ? {
              tabsByWorktree: {
                ...state.tabsByWorktree,
                [worktreeId]: (state.tabsByWorktree[worktreeId] ?? []).map((row) =>
                  row.id === tab.entityId
                    ? {
                        ...row,
                        isHidden: tabs
                          .filter(
                            (entry) =>
                              entry.contentType === 'terminal' && entry.entityId === tab.entityId
                          )
                          .every((entry) => entry.isHidden)
                      }
                    : row
                )
              }
            }
          : {})
      }
      return {
        ...next,
        ...(state.activeWorktreeId === worktreeId
          ? buildActiveSurfacePatch({ ...state, ...next }, worktreeId)
          : {})
      }
    })
    scheduleRuntimeGraphSync()
  }

  return {
    applyTabHidden,
    setTabHidden: async (worktreeId, tabId, isHidden) => {
      const state = get()
      const tab = state.unifiedTabsByWorktree[worktreeId]?.find((entry) => entry.id === tabId)
      if (!tab) {
        throw new Error('tab_not_found')
      }
      const owner = runtimeEnvironmentIdForWorkspaceOwner(state, {
        workspaceId: worktreeId,
        hostId: tab.executionHostId
      })
      if (owner.kind !== 'resolved') {
        throw new Error('workspace_owner_ambiguous')
      }
      const environmentId = owner.environmentId
      const host = parseExecutionHostId(tab.executionHostId)
      if (host?.kind === 'runtime' && host.environmentId !== environmentId) {
        throw new Error('runtime_unavailable')
      }
      if (environmentId) {
        const proof = await runtimeEnvironmentCapabilityProof(
          environmentId,
          SESSION_TABS_TAB_HIDDEN_RUNTIME_CAPABILITY
        )
        if (!proof.supported) {
          throw new Error('capability_unsupported')
        }
        const hostTabId = resolveHostSessionTabIdForWebSessionTab(state, {
          environmentId,
          worktreeId,
          tabId
        })
        if (!hostTabId) {
          throw new Error('tab_not_found')
        }
        const response = await captureRuntimeEnvironmentCall(
          environmentId,
          proof.pairingRevision
        )({
          method: 'session.tabs.setTabProps',
          params: { worktree: toRuntimeWorktreeSelector(worktreeId), tabId: hostTabId, isHidden },
          timeoutMs: 15_000
        })
        const reply = unwrapRuntimeRpcResult(response)
        if (
          typeof reply !== 'object' ||
          reply === null ||
          !('updated' in reply) ||
          reply.updated !== true ||
          !('forwarded' in reply) ||
          typeof reply.forwarded !== 'boolean'
        ) {
          throw new Error('capability_unsupported')
        }
        return { forwarded: reply.forwarded }
      }
      if (ORCA_LAYOUT_OWNER_IS_MAIN) {
        return new Promise((resolve, reject) => {
          const sent = sendLayoutApply(
            state,
            worktreeId,
            { type: 'setTabProps', tabId, isHidden },
            {
              apply: () => resolve({ forwarded: false }),
              asToday: () => {
                applyTabHidden(worktreeId, tabId, isHidden)
                resolve({ forwarded: false })
              },
              refused: (code) => reject(new Error(code))
            }
          )
          if (!sent) {
            applyTabHidden(worktreeId, tabId, isHidden)
            resolve({ forwarded: false })
          }
        })
      }
      applyTabHidden(worktreeId, tabId, isHidden)
      return { forwarded: false }
    }
  }
}

export async function setTabHidden(
  worktreeId: string,
  unifiedTabId: string,
  hidden: boolean
): Promise<{ forwarded: boolean }> {
  const { useAppStore } = await import('../../index')
  return useAppStore.getState().setTabHidden(worktreeId, unifiedTabId, hidden)
}

/** Explicit recovery/search waits for the host's field before activating the tab. */
export async function unhideTabForActivation(
  worktreeId: string,
  unifiedTabId: string
): Promise<void> {
  const { useAppStore } = await import('../../index')
  const tab = useAppStore
    .getState()
    .unifiedTabsByWorktree[worktreeId]?.find((entry) => entry.id === unifiedTabId)
  if (!tab) {
    throw new Error('tab_not_found')
  }
  if (!tab.isHidden) {
    return
  }
  let unsubscribe = (): void => {}
  let timeout: ReturnType<typeof setTimeout> | undefined
  const confirmation = new Promise<void>((resolve, reject) => {
    unsubscribe = useAppStore.subscribe((state) => {
      const current = state.unifiedTabsByWorktree[worktreeId]?.find(
        (entry) => entry.id === unifiedTabId
      )
      if (current && !current.isHidden) {
        resolve()
      } else if (!current) {
        reject(new Error('tab_not_found'))
      }
    })
    timeout = setTimeout(() => reject(new Error('tab_visibility_confirmation_timeout')), 15_000)
  })
  void confirmation.catch(() => {})
  try {
    await setTabHidden(worktreeId, unifiedTabId, false)
    await confirmation
  } finally {
    if (timeout !== undefined) {
      clearTimeout(timeout)
    }
    unsubscribe()
  }
}
