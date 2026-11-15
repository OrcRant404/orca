import { useMemo } from 'react'
import { useAppStore } from '@/store'
import { collectTabGroupLayoutGroupIds } from '../../../../shared/workspace-layout/tab-group-moves'
import { collectLeafIds } from '../../../../shared/workspace-layout/terminal-pane-layout-tree'
import { makePaneKey } from '../../../../shared/workspace-layout/stable-pane-id'
import { teamSidebarScopeKey, useTeamSidebarScopes } from './team-sidebar-scope'

export function useVisibleTeamPanes() {
  const scopes = useTeamSidebarScopes()
  const encoded = useAppStore((state) => {
    const workspace = state.activeWorktreeId
    if (!workspace) {
      return '[]'
    }
    const groups = state.groupsByWorktree[workspace] ?? []
    const tabs = state.unifiedTabsByWorktree[workspace] ?? []
    const groupLayout = state.layoutByWorktree[workspace]
    const visibleGroups = collectTabGroupLayoutGroupIds(groupLayout)
    return JSON.stringify(
      groups.flatMap((group) => {
        if (
          (groupLayout && !visibleGroups.has(group.id)) ||
          !group.activeTabId ||
          !group.tabOrder.includes(group.activeTabId)
        ) {
          return []
        }
        const tab = tabs.find((item) => item.id === group.activeTabId && item.groupId === group.id)
        if (!tab) {
          return []
        }
        if (tab.contentType === 'agent-session') {
          return [
            {
              key: teamSidebarScopeKey(tab.id),
              label: tab.label,
              sessionId: tab.entityId,
              agent: tab.agentSessionAgent ?? 'unknown'
            }
          ]
        }
        if (tab.contentType !== 'terminal') {
          return []
        }
        const layout = state.terminalLayoutsByTabId[tab.id]
        const leaves = layout?.expandedLeafId
          ? [layout.expandedLeafId]
          : layout?.root
            ? collectLeafIds(layout.root)
            : []
        return leaves.map((leaf, index) => ({
          key: teamSidebarScopeKey(tab.id, makePaneKey(tab.id, leaf)),
          label: leaves.length > 1 ? `${tab.label} · ${index + 1}` : tab.label
        }))
      })
    )
  })
  return useMemo(() => {
    const panes: { key: string; label: string; agent?: string; sessionId?: string }[] =
      JSON.parse(encoded)
    return panes.flatMap((pane) => {
      const scope = scopes.get(pane.key)
      return scope &&
        (!pane.sessionId || !scope.sessionId || pane.sessionId === scope.sessionId) &&
        (scope.snapshot.sections.managedBy.length > 0 ||
          scope.snapshot.sections.managing.length > 0)
        ? [{ ...pane, scope }]
        : []
    })
  }, [encoded, scopes])
}
