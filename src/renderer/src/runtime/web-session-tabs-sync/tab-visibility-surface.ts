import type { WebSessionTabsSyncState } from './state'
import { deriveActiveSurfaceForWorktree } from '../../store/slices/tabs/tabs-surface'

/** Shared visibility can invalidate this client's sticky surface without changing its layout. */
export function tabVisibilitySurfacePatch(
  state: WebSessionTabsSyncState,
  patch: Partial<WebSessionTabsSyncState>,
  worktreeId: string
): Partial<WebSessionTabsSyncState> {
  const next = { ...state, ...patch }
  const group = next.groupsByWorktree[worktreeId]?.find(
    (entry) => entry.id === next.activeGroupIdByWorktree[worktreeId]
  )
  if (
    group?.activeTabId !== null &&
    ![
      ...(state.unifiedTabsByWorktree[worktreeId] ?? []),
      ...(next.unifiedTabsByWorktree[worktreeId] ?? [])
    ].some((tab) => tab.isHidden)
  ) {
    return patch
  }
  const surface = deriveActiveSurfaceForWorktree(next, worktreeId)
  return {
    ...patch,
    activeTabIdByWorktree: { ...next.activeTabIdByWorktree, [worktreeId]: surface.activeTabId },
    activeBrowserTabIdByWorktree: {
      ...next.activeBrowserTabIdByWorktree,
      [worktreeId]: surface.activeBrowserTabId
    },
    activeFileIdByWorktree: { ...next.activeFileIdByWorktree, [worktreeId]: surface.activeFileId },
    activeTabTypeByWorktree: {
      ...next.activeTabTypeByWorktree,
      [worktreeId]: surface.activeTabType
    },
    ...(state.activeWorktreeId === worktreeId ? surface : {})
  }
}
