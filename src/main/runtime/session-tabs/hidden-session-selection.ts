import type { WorkspaceSessionState } from '../../../shared/workspace-session/workspace-session-state-types'
import type { RuntimeMobileSessionTabsSnapshot } from '../../../shared/runtime-session-contracts'
import { visibleActiveTabId } from '../../../shared/workspace-layout/tab-visibility'
import { normalizeMobileSessionTabSelection } from './mobile-session-tab-selection'

export function reconcileHiddenSessionSelection(
  session: WorkspaceSessionState,
  worktreeId: string
): WorkspaceSessionState {
  const tabs = session.unifiedTabs?.[worktreeId] ?? []
  const groups = session.tabGroups?.[worktreeId]
  const rows = session.tabsByWorktree[worktreeId] ?? []
  const selected = session.activeTabIdByWorktree?.[worktreeId] ?? session.activeTabId
  const activeTabId =
    selected && rows.some((row) => row.id === selected && row.isHidden)
      ? (rows.find((row) => !row.isHidden)?.id ?? null)
      : selected
  return {
    ...session,
    ...(activeTabId !== selected
      ? {
          activeTabIdByWorktree: { ...session.activeTabIdByWorktree, [worktreeId]: activeTabId },
          ...(session.activeWorktreeId === worktreeId ? { activeTabId } : {})
        }
      : {}),
    ...(groups
      ? {
          tabGroups: {
            ...session.tabGroups,
            [worktreeId]: groups.map((group) => ({
              ...group,
              activeTabId: visibleActiveTabId(
                group.tabOrder,
                group.recentTabIds,
                group.activeTabId,
                tabs
              )
            }))
          }
        }
      : {})
  }
}

/** A visibility change is not removal: retain every order, group, pane and row. */
export function followHiddenSnapshotSelection(
  snapshot: RuntimeMobileSessionTabsSnapshot
): RuntimeMobileSessionTabsSnapshot {
  const tabs = snapshot.tabs.flatMap((tab) => [
    { id: tab.type === 'terminal' ? tab.parentTabId : tab.id, isHidden: tab.isHidden },
    ...(tab.type === 'browser' ? [{ id: tab.browserWorkspaceId, isHidden: tab.isHidden }] : [])
  ])
  const tabGroups = snapshot.tabGroups?.map((group) => ({
    ...group,
    activeTabId: visibleActiveTabId(group.tabOrder, group.recentTabIds, group.activeTabId, tabs)
  }))
  if (!tabGroups && snapshot.tabs.some((tab) => tab.id === snapshot.activeTabId && tab.isHidden)) {
    const active = snapshot.tabs.find((tab) => !tab.isHidden) ?? null
    return normalizeMobileSessionTabSelection({
      ...snapshot,
      activeTabId: active?.id ?? null,
      activeTabType: active?.type ?? null,
      tabs: snapshot.tabs.map((tab) => ({ ...tab, isActive: tab === active }))
    })
  }
  return normalizeMobileSessionTabSelection({ ...snapshot, ...(tabGroups ? { tabGroups } : {}) })
}
