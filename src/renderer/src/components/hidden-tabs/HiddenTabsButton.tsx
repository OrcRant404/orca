import { useRef, useState } from 'react'
import { useAppStore } from '@/store'
import type { Tab } from '../../../../shared/tab-types'
import { resolveUnifiedTabLabel } from '../../../../shared/tab-title-resolution'
import { useOpenTabSearch } from '@/components/tab-bar/use-open-tab-search'
import { unhideTabForActivation } from '@/store/slices/tabs/tabs-visibility-actions'
import { unhideAndActivateWorkspaceTabPaletteResult } from '@/lib/workspace/search/tabs/workspace-tab-palette-activation'
import { unhideAndActivateSimulatorTabPaletteResult } from '@/lib/simulator-tab-palette-activation'
import { activateBrowserWorkspaceTab } from '@/lib/browser/workspace/browser-workspace-tab-activation'
import { HiddenTabsPopover, type HiddenTabRow } from './HiddenTabsPopover'
import { setTabHiddenAndConfirm, useHiddenTabsCapability } from './hidden-tab-actions'

const EMPTY_TABS: Tab[] = []
export function HiddenTabsButton({ worktreeId }: { worktreeId: string }) {
  const [open, setOpen] = useState(false)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inFlight = useRef(false)
  const retry = useRef<(() => Promise<void>) | null>(null)
  const supported = useHiddenTabsCapability(worktreeId)
  const tabs = useAppStore((state) => state.unifiedTabsByWorktree[worktreeId] ?? EMPTY_TABS)
  const groups = useAppStore((state) => state.groupsByWorktree[worktreeId])
  const generated = useAppStore((state) => state.settings?.tabAutoGenerateTitle === true)
  const { entries } = useOpenTabSearch({ enabled: open, query: '', worktreeId })
  const rows = [...tabs]
    .filter((tab) => tab.isHidden)
    .sort((a, b) => {
      const groupOrder =
        (groups?.findIndex((group) => group.id === a.groupId) ?? 0) -
        (groups?.findIndex((group) => group.id === b.groupId) ?? 0)
      const group = groups?.find((candidate) => candidate.id === a.groupId)
      return (
        groupOrder ||
        (group?.tabOrder.indexOf(a.id) ?? a.sortOrder) -
          (group?.tabOrder.indexOf(b.id) ?? b.sortOrder)
      )
    })
    .map((tab): HiddenTabRow => {
      const entry = entries?.workspaceTabs.find((candidate) => candidate.tab.id === tab.id)
      const pages = entries?.browserPages.filter((page) => page.workspace.id === tab.entityId) ?? []
      const title = entry?.title ?? resolveUnifiedTabLabel(tab, generated)
      return {
        tab,
        title,
        detail: entry?.secondaryText ?? pages[0]?.page.url ?? tab.contentType,
        keywords: [
          ...(entry?.secondarySearchTexts ?? []),
          ...pages.flatMap((page) => [page.page.title, page.page.url])
        ]
      }
    })
  const run = (action: () => Promise<void>) => {
    if (inFlight.current) {
      return
    }
    inFlight.current = true
    retry.current = action
    setError(null)
    setPending(true)
    void action()
      .catch((caught: unknown) => {
        setOpen(true)
        setError(caught instanceof Error ? caught.message : String(caught))
      })
      .finally(() => {
        inFlight.current = false
        setPending(false)
      })
  }
  const activate = async ({ tab }: HiddenTabRow) => {
    const target = { ...tab, tabId: tab.id }
    if (tab.contentType === 'browser') {
      await unhideTabForActivation(worktreeId, tab.id)
      if (
        !activateBrowserWorkspaceTab({
          worktreeId,
          workspaceId: tab.entityId,
          executionHostId: tab.executionHostId
        })
      ) {
        throw new Error('Tab no longer exists')
      }
      const state = useAppStore.getState()
      const current = state.unifiedTabsByWorktree[worktreeId]?.find((row) => row.id === tab.id)
      if (!current) {
        throw new Error('Tab no longer exists')
      }
      state.focusGroup(worktreeId, current.groupId)
      state.activateTab(current.id, { worktreeId })
    } else {
      const result =
        tab.contentType === 'simulator'
          ? await unhideAndActivateSimulatorTabPaletteResult(target)
          : await unhideAndActivateWorkspaceTabPaletteResult({
              ...target,
              contentType: tab.contentType
            })
      if (result.status !== 'activated') {
        throw new Error(
          result.status === 'blocked' ? 'Workspace could not be opened' : 'Tab no longer exists'
        )
      }
    }
    setOpen(false)
  }
  return (
    <HiddenTabsPopover
      rows={rows}
      open={open}
      onOpenChange={setOpen}
      supported={supported}
      pending={pending}
      error={error}
      onRetry={() => retry.current && run(retry.current)}
      onActivate={(row) => run(() => activate(row))}
      onUnhide={(row) => run(() => setTabHiddenAndConfirm(worktreeId, row.tab.id, false))}
      onUnhideAll={() =>
        run(async () => {
          for (const row of rows) {
            if (
              useAppStore
                .getState()
                .unifiedTabsByWorktree[worktreeId]?.some(
                  (tab) => tab.id === row.tab.id && tab.isHidden
                )
            ) {
              await setTabHiddenAndConfirm(worktreeId, row.tab.id, false)
            }
          }
        })
      }
    />
  )
}
