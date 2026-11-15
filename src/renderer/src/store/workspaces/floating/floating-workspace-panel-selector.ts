import { FLOATING_TERMINAL_WORKTREE_ID } from '../../../../../shared/constants'
import type { TerminalTab } from '../../../../../shared/workspace-layout/terminal-tab-types'
import type { AppState } from '../../types'

export type FloatingWorkspacePanelVisibilityState = Pick<
  AppState,
  'settings' | 'floatingWorkspacePanelOpen'
>

type FloatingTabInventoryState = Pick<
  AppState,
  'browserTabsByWorktree' | 'openFiles' | 'tabsByWorktree' | 'unifiedTabsByWorktree'
>
export type EmptyFloatingWorkspacePanelState = FloatingWorkspacePanelVisibilityState &
  FloatingTabInventoryState
type FloatingTabCountCache = {
  terminalTabs: NonNullable<AppState['tabsByWorktree'][string]>
  browserTabs: NonNullable<AppState['browserTabsByWorktree'][string]>
  openFiles: AppState['openFiles']
  unifiedTabs: NonNullable<AppState['unifiedTabsByWorktree'][string]>
  visibleCount: number
  hasBackedTabs: boolean
}

const EMPTY_TABS: TerminalTab[] = []
const EMPTY_BROWSER_TABS: NonNullable<AppState['browserTabsByWorktree'][string]> = []
const EMPTY_UNIFIED_TABS: NonNullable<AppState['unifiedTabsByWorktree'][string]> = []

let floatingTabCountCache: FloatingTabCountCache | null = null

/** Panel is visible only with feature enabled and panel open; closed panels are aria-hidden. */
export function selectFloatingWorkspacePanelVisible(
  state: FloatingWorkspacePanelVisibilityState
): boolean {
  return state.settings?.floatingTerminalEnabled === true && state.floatingWorkspacePanelOpen
}

function selectFloatingTabCounts(state: FloatingTabInventoryState): FloatingTabCountCache {
  const terminalTabs = state.tabsByWorktree[FLOATING_TERMINAL_WORKTREE_ID] ?? EMPTY_TABS
  const browserTabs =
    state.browserTabsByWorktree[FLOATING_TERMINAL_WORKTREE_ID] ?? EMPTY_BROWSER_TABS
  const unifiedTabs =
    state.unifiedTabsByWorktree[FLOATING_TERMINAL_WORKTREE_ID] ?? EMPTY_UNIFIED_TABS
  const cached = floatingTabCountCache
  if (
    cached &&
    cached.terminalTabs === terminalTabs &&
    cached.browserTabs === browserTabs &&
    cached.openFiles === state.openFiles &&
    cached.unifiedTabs === unifiedTabs
  ) {
    return cached
  }

  const terminalIds = new Set<string>()
  for (const tab of terminalTabs) {
    terminalIds.add(tab.id)
  }
  const browserIds = new Set<string>()
  for (const tab of browserTabs) {
    browserIds.add(tab.id)
  }
  const editorIds = new Set<string>()
  for (const file of state.openFiles) {
    if (file.worktreeId === FLOATING_TERMINAL_WORKTREE_ID) {
      editorIds.add(file.id)
    }
  }

  let visibleCount = 0
  let hasBackedTabs = false
  for (const tab of unifiedTabs) {
    const backed =
      tab.contentType === 'terminal'
        ? terminalIds.has(tab.entityId)
        : tab.contentType === 'browser'
          ? browserIds.has(tab.entityId)
          : tab.contentType === 'simulator' || tab.contentType === 'agent-session'
            ? true
            : editorIds.has(tab.entityId)
    if (backed) {
      hasBackedTabs = true
      if (!tab.isHidden) {
        visibleCount += 1
      }
    }
  }

  floatingTabCountCache = {
    terminalTabs,
    browserTabs,
    openFiles: state.openFiles,
    unifiedTabs,
    visibleCount,
    hasBackedTabs
  }
  return floatingTabCountCache
}

export function selectFloatingVisibleTabCount(state: FloatingTabInventoryState): number {
  return selectFloatingTabCounts(state).visibleCount
}

export function selectFloatingHasBackedTabs(state: FloatingTabInventoryState): boolean {
  return selectFloatingTabCounts(state).hasBackedTabs
}

export function resetFloatingVisibleTabCountSelectorCacheForTest(): void {
  floatingTabCountCache = null
}

export function selectEmptyFloatingWorkspacePanelVisible(
  state: EmptyFloatingWorkspacePanelState
): boolean {
  return selectFloatingWorkspacePanelVisible(state) && selectFloatingVisibleTabCount(state) === 0
}
