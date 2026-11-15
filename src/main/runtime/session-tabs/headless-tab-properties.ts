import { followHiddenSnapshotSelection } from './hidden-session-selection'
import { withSessionTabProps } from './session-tab-properties-state'
import { renameStructuredSessionTab, type SessionTabProps } from './structured-session-tab-rename'
import { OrcaRuntimeWithHeadlessPaneMoveToNewTab } from './headless-pane-move-to-new-tab'
import type { RuntimeMobileSessionTabsSnapshot } from '../../../shared/runtime-session-contracts'
import type { RuntimeMobileSessionSnapshotTab } from '../../../shared/runtime-mobile-session-tab-contracts'
import type { TerminalLayoutSnapshot } from '../../../shared/workspace-layout/terminal-tab-types'
import { ORCA_LAYOUT_OWNER_IS_MAIN } from '../../../shared/layout-owner-switch'
import { cloneTerminalLayoutSnapshot } from '../terminal/surface/mobile-session-layout-projection'
import { paneLayoutEditIsNoOp, type HeadlessPaneLayoutEdit } from './headless-pane-layout-edit'

export abstract class RuntimeHeadlessTabProperties extends OrcaRuntimeWithHeadlessPaneMoveToNewTab {
  // Remote tab color/pin need persistence and live publication or the next snapshot reverts them.
  async setMobileSessionTabProps(
    worktreeSelector: string,
    args: SessionTabProps
  ): Promise<{ updated: true; forwarded?: boolean }> {
    const explicitWorktreeId = this.getExplicitSessionWorktreeIdSelector(worktreeSelector)
    const worktreeId =
      explicitWorktreeId ?? (await this.resolveWorkspaceSelector(worktreeSelector)).id
    this.hydrateHeadlessMobileSessionTabsFromWorkspaceSession(worktreeId)
    // Attached renderers own and republish props; headless writes would be overwritten.
    const snapshot = this.mobileSessionTabsByWorktree.get(worktreeId)
    const hostTabId = snapshot
      ? (this.resolveMobileSessionHostTabId(snapshot, args.tabId) ?? args.tabId)
      : args.tabId
    if (ORCA_LAYOUT_OWNER_IS_MAIN && (await this.setMainTabProps(worktreeId, hostTabId, args))) {
      return { updated: true, ...(args.isHidden !== undefined ? { forwarded: false } : {}) }
    }
    const authoritativeWindow = this.getAvailableAuthoritativeWindow()
    if (
      authoritativeWindow &&
      (args.color !== undefined || args.isPinned !== undefined || args.viewMode !== undefined)
    ) {
      throw Object.assign(
        new Error(
          'Tab color, pin, and view mode edits are unavailable while a desktop window owns the layout'
        ),
        { code: 'capability_unsupported' }
      )
    }
    if (args.isHidden !== undefined && authoritativeWindow) {
      if (args.customTitle !== undefined) {
        throw Object.assign(
          new Error(
            'Combined title and visibility edits are unavailable while a desktop window owns the layout'
          ),
          { code: 'capability_unsupported' }
        )
      }
      if (!snapshot || !this.resolveMobileSessionHostTabId(snapshot, args.tabId)) {
        throw new Error('tab_not_found')
      }
      if (!this.notifier?.setSessionTabHidden?.(worktreeId, hostTabId, args.isHidden)) {
        throw Object.assign(new Error('The attached desktop cannot apply hidden tabs'), {
          code: 'capability_unsupported'
        })
      }
      return { updated: true, forwarded: true }
    }
    if (args.isHidden !== undefined) {
      const session = this.getWorkspaceSessionForWorktree(worktreeId)
      const unifiedId = this.persistedUnifiedTabId(worktreeId, hostTabId)
      if (
        !session ||
        !this.store?.setWorkspaceSession ||
        !(
          session.unifiedTabs?.[worktreeId]?.some(
            (tab) => tab.id === unifiedId || tab.entityId === unifiedId
          ) || session.tabsByWorktree[worktreeId]?.some((tab) => tab.id === hostTabId)
        )
      ) {
        throw new Error('tab_not_found')
      }
    }
    args = await renameStructuredSessionTab(snapshot, hostTabId, args, () =>
      this.ensureStructuredAgentSessionHost()
    )
    // Sleeping/starting panes lack handles, so title edits must address the tab (#29975).
    const customTitle =
      args.customTitle === undefined ? undefined : args.customTitle?.trim() || null
    if (authoritativeWindow) {
      if (customTitle !== undefined) {
        this.notifier?.renameTerminal(hostTabId, customTitle)
      }
      return { updated: true }
    }
    this.persistHeadlessSessionTabProps(worktreeId, hostTabId, args)
    // Why: a live pane's own title outranks the snapshot's, so name it the way terminal.rename does.
    const liveHandles =
      customTitle === undefined
        ? []
        : this.getPtyIdsForExplicitTabClose(worktreeId, hostTabId).flatMap((ptyId) => {
            const handle = this.handleByPtyId.get(ptyId)
            return handle ? [handle] : []
          })
    for (const handle of liveHandles) {
      await this.renameTerminal(handle, customTitle ?? null)
    }
    if (customTitle !== undefined && liveHandles.length === 0) {
      this.persistHeadlessTerminalTitle(worktreeId, hostTabId, customTitle)
    }
    // A live pane's rename above already set its title; only a paneless tab needs `title` here.
    this.applyHeadlessSessionTabPropsToSnapshot(worktreeId, hostTabId, {
      ...args,
      ...(customTitle !== undefined && liveHandles.length === 0
        ? {
            customTitle,
            title: customTitle ?? this.headlessTerminalFallbackTitle(worktreeId, hostTabId)
          }
        : {})
    })
    return { updated: true, ...(args.isHidden !== undefined ? { forwarded: false } : {}) }
  }

  /** What `title` reads once a manual name is cleared; readers that predate `customTitle` show it. */
  protected headlessTerminalFallbackTitle(worktreeId: string, tabId: string): string {
    const tab = this.getWorkspaceSessionForWorktree(worktreeId)?.tabsByWorktree[worktreeId]?.find(
      (candidate) => candidate.id === tabId
    )
    return (
      tab?.generatedTitle?.trim() || tab?.title?.trim() || tab?.defaultTitle?.trim() || 'Terminal'
    )
  }

  private persistedUnifiedTabId(worktreeId: string, tabId: string): string {
    const row = this.mobileSessionTabsByWorktree
      .get(worktreeId)
      ?.tabs.find((tab) => tab.id === tabId)
    const session = this.getWorkspaceSessionForWorktree(worktreeId)
    return row?.type === 'agent-session'
      ? (session?.unifiedTabs?.[worktreeId]?.find(
          (tab) => tab.contentType === 'agent-session' && tab.entityId === row.sessionId
        )?.id ?? tabId)
      : this.serveBrowserTabs.unifiedTabId(worktreeId, tabId)
  }

  protected persistHeadlessSessionTabProps(
    worktreeId: string,
    tabId: string,
    props: {
      color?: string | null
      isPinned?: boolean
      isHidden?: boolean
      viewMode?: 'terminal' | 'chat'
    }
  ): void {
    const session = this.getWorkspaceSessionForWorktree(worktreeId)
    if (!session || !this.store?.setWorkspaceSession) {
      return
    }
    const updated = withSessionTabProps(
      session,
      worktreeId,
      tabId,
      this.persistedUnifiedTabId(worktreeId, tabId),
      props
    )
    if (updated) {
      this.setWorkspaceSessionForWorktree(worktreeId, updated)
    }
  }

  protected applyHeadlessSessionTabPropsToSnapshot(
    worktreeId: string,
    tabId: string,
    props: {
      title?: string
      customTitle?: string | null
      color?: string | null
      isPinned?: boolean
      isHidden?: boolean
      viewMode?: 'terminal' | 'chat'
    }
  ): void {
    const snapshot = this.mobileSessionTabsByWorktree.get(worktreeId)
    if (!snapshot) {
      return
    }
    let changed = false
    const tabs = snapshot.tabs.map((tab) => {
      if (this.getMobileSessionTopLevelTabId(tab) !== tabId) {
        return tab
      }
      changed = true
      return {
        ...tab,
        ...(props.title !== undefined ? { title: props.title } : {}),
        ...(props.customTitle !== undefined && tab.type === 'terminal'
          ? { customTitle: props.customTitle }
          : {}),
        ...(props.color !== undefined ? { color: props.color } : {}),
        ...(props.isPinned !== undefined ? { isPinned: props.isPinned } : {}),
        ...(props.isHidden !== undefined ? { isHidden: props.isHidden } : {}),
        ...(props.viewMode !== undefined ? { viewMode: props.viewMode } : {})
      }
    })
    if (!changed) {
      return
    }
    const nextSnapshot: RuntimeMobileSessionTabsSnapshot = {
      ...snapshot,
      publicationEpoch: `headless:${Date.now().toString(36)}`,
      snapshotVersion: snapshot.snapshotVersion + 1,
      tabs
    }
    const selected =
      props.isHidden !== undefined ? followHiddenSnapshotSelection(nextSnapshot) : nextSnapshot
    this.storeMobileSessionSnapshot(worktreeId, selected)
    this.emitMobileSessionTabsSnapshot(selected)
  }

  protected getMobileSessionTopLevelTabId(tab: RuntimeMobileSessionSnapshotTab): string {
    return tab.type === 'terminal' ? tab.parentTabId : tab.id
  }

  // Merge only client geometry/titles; PTY bindings and active leaf remain host-owned. Layouts are keyed by tab, independent of worktree.
  protected persistHeadlessTerminalPaneLayout(
    worktreeId: string,
    args: HeadlessPaneLayoutEdit
  ): TerminalLayoutSnapshot | undefined {
    const session = this.getWorkspaceSessionForWorktree(worktreeId)
    if (!session || !this.store?.setWorkspaceSession) {
      return undefined
    }
    const existing = session.terminalLayoutsByTabId?.[args.tabId]
    if (!existing) {
      return undefined
    }
    if (paneLayoutEditIsNoOp(existing, args)) {
      return existing
    }
    const candidate = {
      ...session,
      terminalLayoutsByTabId: {
        ...session.terminalLayoutsByTabId,
        [args.tabId]: {
          ...cloneTerminalLayoutSnapshot(existing),
          root: args.root ?? existing.root,
          expandedLeafId: args.expandedLeafId,
          ...(args.chatLeafId !== undefined ? { chatLeafId: args.chatLeafId ?? undefined } : {}),
          ...(args.titlesByLeafId ? { titlesByLeafId: args.titlesByLeafId } : {})
        }
      }
    }
    this.setWorkspaceSessionForWorktree(worktreeId, candidate)
    // Publish the persisted rebase: stale membership may be rejected while metadata is accepted.
    return (
      this.getWorkspaceSessionForWorktree(worktreeId)?.terminalLayoutsByTabId[args.tabId] ??
      candidate.terminalLayoutsByTabId[args.tabId]
    )
  }

  protected applyHeadlessTerminalPaneLayoutToSnapshot(
    worktreeId: string,
    args: HeadlessPaneLayoutEdit
  ): void {
    const snapshot = this.mobileSessionTabsByWorktree.get(worktreeId)
    if (!snapshot) {
      return
    }
    let changed = false
    const tabs = snapshot.tabs.map((tab) => {
      if (
        tab.type !== 'terminal' ||
        tab.parentTabId !== args.tabId ||
        !tab.parentLayout ||
        paneLayoutEditIsNoOp(tab.parentLayout, args)
      ) {
        return tab
      }
      changed = true
      return {
        ...tab,
        parentLayout: {
          ...tab.parentLayout,
          root: args.root ?? tab.parentLayout.root,
          expandedLeafId: args.expandedLeafId,
          ...(args.chatLeafId !== undefined ? { chatLeafId: args.chatLeafId ?? undefined } : {}),
          ...(args.titlesByLeafId ? { titlesByLeafId: args.titlesByLeafId } : {})
        }
      }
    })
    if (!changed) {
      return
    }
    const nextSnapshot: RuntimeMobileSessionTabsSnapshot = {
      ...snapshot,
      publicationEpoch: `headless:${Date.now().toString(36)}`,
      snapshotVersion: snapshot.snapshotVersion + 1,
      tabs
    }
    this.storeMobileSessionSnapshot(worktreeId, nextSnapshot)
    this.emitMobileSessionTabsSnapshot(nextSnapshot)
  }
}
