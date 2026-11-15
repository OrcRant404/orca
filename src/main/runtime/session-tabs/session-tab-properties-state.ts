import type { WorkspaceSessionState } from '../../../shared/workspace-session/workspace-session-state-types'
import type { SessionTabProps } from './structured-session-tab-rename'
import { reconcileHiddenSessionSelection } from './hidden-session-selection'

export function withSessionTabProps(
  session: WorkspaceSessionState,
  worktreeId: string,
  tabId: string,
  unifiedId: string,
  props: Pick<SessionTabProps, 'color' | 'isPinned' | 'isHidden' | 'viewMode'>
): WorkspaceSessionState | null {
  const tabs = session.tabsByWorktree[worktreeId]
  const nextSession: WorkspaceSessionState = { ...session }
  let changed = false
  if (tabs?.some((tab) => tab.id === tabId)) {
    changed = true
    nextSession.tabsByWorktree = {
      ...session.tabsByWorktree,
      [worktreeId]: tabs.map((tab) =>
        tab.id === tabId
          ? {
              ...tab,
              ...(props.color !== undefined ? { color: props.color } : {}),
              ...(props.isPinned !== undefined ? { isPinned: props.isPinned } : {}),
              ...(props.isHidden !== undefined ? { isHidden: props.isHidden } : {}),
              ...(props.viewMode !== undefined ? { viewMode: props.viewMode } : {})
            }
          : tab
      )
    }
  }

  const unifiedTabs = session.unifiedTabs?.[worktreeId]
  // A browser row is named by its page; a window keys the tab's props by the saved tab.
  if (unifiedTabs?.some((tab) => tab.id === unifiedId || tab.entityId === unifiedId)) {
    changed = true
    nextSession.unifiedTabs = {
      ...session.unifiedTabs,
      [worktreeId]: unifiedTabs.map((tab) =>
        tab.id === unifiedId || tab.entityId === unifiedId
          ? {
              ...tab,
              ...(props.color !== undefined ? { color: props.color } : {}),
              ...(props.isPinned !== undefined ? { isPinned: props.isPinned } : {}),
              ...(props.isHidden !== undefined ? { isHidden: props.isHidden } : {})
            }
          : tab
      )
    }
  }

  if (!changed) {
    return null
  }
  return props.isHidden !== undefined
    ? reconcileHiddenSessionSelection(nextSession, worktreeId)
    : nextSession
}
