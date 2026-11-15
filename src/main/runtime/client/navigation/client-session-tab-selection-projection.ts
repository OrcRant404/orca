import type { RuntimeMobileSessionClientTab } from '../../../../shared/runtime-mobile-session-tab-contracts'
import type { RuntimeMobileSessionTabsResult } from '../../../../shared/runtime-session-contracts'
import { visibleTabOrder } from '../../../../shared/workspace-layout/tab-visibility'
import { pickNextActiveTabAfterClose } from '../../../../shared/workspace-session/workspace-session-terminal-tab-close'
import { findSiblingGroupId } from '../../../../shared/workspace-layout/tab-group-layout-tree'

export type ClientSessionTabSelection = {
  activeTabId: string | null
  activeGroupId: string | null
  activeTabIdByGroupId: Readonly<Record<string, string | null>>
  /** Most recent last; drives fallback after close. */
  recentTabIds?: string[]
}

/** Last-shown topology locates the closed tab/group. */
export type ClientSessionTabTopology = Pick<
  RuntimeMobileSessionTabsResult,
  'tabGroups' | 'tabGroupLayout'
>

export function emptyClientSessionTabSelection(): ClientSessionTabSelection {
  return { activeTabId: null, activeGroupId: null, activeTabIdByGroupId: {} }
}

export function topLevelTabId(tab: RuntimeMobileSessionClientTab): string {
  if (tab.type === 'terminal') {
    return tab.parentTabId
  }
  return tab.id
}

function findTabByTopLevelId(
  snapshot: RuntimeMobileSessionTabsResult,
  topLevelId: string | null | undefined
): RuntimeMobileSessionClientTab | null {
  if (!topLevelId) {
    return null
  }
  return (
    snapshot.tabs.find(
      (tab) =>
        !tab.isHidden &&
        (topLevelTabId(tab) === topLevelId ||
          (tab.type === 'browser' && tab.browserWorkspaceId === topLevelId))
    ) ?? null
  )
}

export function deriveClientSessionTabSelection(
  snapshot: RuntimeMobileSessionTabsResult
): ClientSessionTabSelection {
  return {
    activeTabId: snapshot.activeTabId,
    activeGroupId: snapshot.activeGroupId,
    activeTabIdByGroupId: Object.fromEntries(
      snapshot.tabGroups?.flatMap((group) =>
        group.activeTabId ||
        snapshot.tabs.some((tab) => tab.isHidden && group.tabOrder.includes(topLevelTabId(tab)))
          ? [[group.id, group.activeTabId] as const]
          : []
      ) ?? []
    ),
    recentTabIds: snapshot.tabGroups?.flatMap((group) => group.recentTabIds ?? []) ?? []
  }
}

export function activateClientSessionTabSelection(
  snapshot: RuntimeMobileSessionTabsResult,
  selection: ClientSessionTabSelection,
  activeTabId: string
): ClientSessionTabSelection {
  const activeTab = snapshot.tabs.find((tab) => tab.id === activeTabId)
  if (!activeTab) {
    return selection
  }
  const activeTopLevelTabId = topLevelTabId(activeTab)
  const activeGroup = snapshot.tabGroups?.find((group) =>
    group.tabOrder.includes(activeTopLevelTabId)
  )
  const presentTabIds = new Set(snapshot.tabs.map(topLevelTabId))
  return {
    activeTabId,
    activeGroupId: activeGroup?.id ?? selection.activeGroupId,
    activeTabIdByGroupId: activeGroup
      ? { ...selection.activeTabIdByGroupId, [activeGroup.id]: activeTopLevelTabId }
      : selection.activeTabIdByGroupId,
    recentTabIds: [
      ...(selection.recentTabIds ?? []).filter(
        (id) => id !== activeTopLevelTabId && presentTabIds.has(id)
      ),
      activeTopLevelTabId
    ]
  }
}

export function projectClientSessionTabSelection(
  snapshot: RuntimeMobileSessionTabsResult,
  selection: ClientSessionTabSelection,
  before?: ClientSessionTabTopology
): { snapshot: RuntimeMobileSessionTabsResult; selection: ClientSessionTabSelection } {
  const activeTabIdByGroupId: Record<string, string | null> = {}
  const tabGroups = snapshot.tabGroups?.map((group) => {
    const visibleOrder = visibleTabOrder(
      group.tabOrder,
      snapshot.tabs.flatMap((tab) => [
        { id: topLevelTabId(tab), isHidden: tab.isHidden },
        ...(tab.type === 'browser' ? [{ id: tab.browserWorkspaceId, isHidden: tab.isHidden }] : [])
      ])
    )
    const selected = selection.activeTabIdByGroupId[group.id]
    // Match desktop close/move using this client's recency.
    const activeTabId =
      selected && !visibleOrder.includes(selected)
        ? pickNextActiveTabAfterClose(
            {
              tabOrder:
                before?.tabGroups?.find((candidate) => candidate.id === group.id)?.tabOrder ??
                group.tabOrder,
              // Legacy selections lack recency; fall back to the host's.
              recentTabIds: selection.recentTabIds ?? group.recentTabIds
            },
            new Set([selected]),
            visibleOrder,
            new Set(visibleOrder)
          )
        : selected === null
          ? null
          : (selected ?? visibleOrder[0] ?? null)
    if (
      activeTabId !== null ||
      selected !== undefined ||
      snapshot.tabs.some((tab) => tab.isHidden && group.tabOrder.includes(topLevelTabId(tab)))
    ) {
      activeTabIdByGroupId[group.id] = activeTabId
    }
    return { ...group, activeTabId }
  })
  const shownGroups = tabGroups?.filter((group) => group.tabOrder.length > 0)
  // Match desktop collapseGroupLayout: hand an empty group to its split sibling.
  const siblingGroupId =
    selection.activeGroupId && before?.tabGroupLayout
      ? findSiblingGroupId(before.tabGroupLayout, selection.activeGroupId)
      : null
  const selectedGroup =
    shownGroups?.find((group) => group.id === selection.activeGroupId) ??
    shownGroups?.find((group) => group.id === siblingGroupId) ??
    shownGroups?.[0]
  const activeTab =
    snapshot.tabs.find((tab) => !tab.isHidden && tab.id === selection.activeTabId) ??
    findTabByTopLevelId(snapshot, selectedGroup?.activeTabId) ??
    (selectedGroup ? null : snapshot.tabs.find((tab) => !tab.isHidden)) ??
    null
  const activeTopLevelTabId = activeTab ? topLevelTabId(activeTab) : null
  const activeGroupId =
    tabGroups?.find((group) =>
      activeTopLevelTabId ? group.tabOrder.includes(activeTopLevelTabId) : false
    )?.id ??
    (selection.activeGroupId && tabGroups?.some((group) => group.id === selection.activeGroupId)
      ? selection.activeGroupId
      : null) ??
    tabGroups?.[0]?.id ??
    null
  const nextSelection: ClientSessionTabSelection = {
    activeTabId: activeTab?.id ?? null,
    activeGroupId,
    activeTabIdByGroupId,
    ...(selection.recentTabIds ? { recentTabIds: selection.recentTabIds } : {})
  }
  return {
    selection: nextSelection,
    snapshot: {
      ...snapshot,
      activeGroupId,
      activeTabId: activeTab?.id ?? null,
      activeTabType: activeTab?.type ?? null,
      ...(tabGroups ? { tabGroups } : {}),
      tabs: snapshot.tabs.map((tab) => ({ ...tab, isActive: tab.id === activeTab?.id }))
    }
  }
}
