import { useCallback, useRef } from 'react'
import { toast } from 'sonner'
import { translate } from '@/i18n/i18n'
import { unhideAndActivateBrowserPagePaletteResult } from '@/lib/browser/palette/browser-page-palette-activation'
import { unhideAndActivateSimulatorTabPaletteResult } from '@/lib/simulator-tab-palette-activation'
import { unhideAndActivateWorkspaceTabPaletteResult } from '@/lib/workspace/search/tabs/workspace-tab-palette-activation'
import type { BrowserPaletteSearchResult } from '@/lib/browser/palette/browser-palette-search'
import type { SimulatorPaletteSearchResult } from '@/lib/simulator-palette-search-types'
import type { WorkspaceTabPaletteSearchResult } from '@/lib/workspace/search/tabs/workspace-tab-palette-results'
import type { WorktreeJumpPaletteSelectionLifecycle } from './use-worktree-jump-palette-selection-lifecycle'
import type { WorktreeJumpPaletteStoreState } from './use-worktree-jump-palette-store-state'
export function useWorktreeJumpOpenTabSelection({
  dismissForSelection,
  recordFeatureInteraction,
  requestBrowserFocus
}: {
  dismissForSelection: () => void
  recordFeatureInteraction: WorktreeJumpPaletteStoreState['recordFeatureInteraction']
  requestBrowserFocus: WorktreeJumpPaletteSelectionLifecycle['requestBrowserFocus']
}) {
  const pending = useRef(false)
  const handleSelectBrowserPage = useCallback(
    async (result: BrowserPaletteSearchResult) => {
      if (pending.current) {
        return
      }
      pending.current = true
      const progress = result.isHidden
        ? toast.loading(translate('tabs.hidden.waiting', 'Waiting for the host…'))
        : undefined
      try {
        const activation = await unhideAndActivateBrowserPagePaletteResult(result)
        if (activation.status === 'blocked') {
          return
        }
        if (activation.status === 'failed') {
          toast.error(
            activation.reason === 'missing-page'
              ? translate(
                  'auto.components.WorktreeJumpPalette.d7d496a451',
                  'Browser page no longer exists'
                )
              : translate(
                  'auto.components.WorktreeJumpPalette.2c38630a01',
                  'Workspace no longer exists'
                )
          )
          return
        }
        recordFeatureInteraction('cmd-j-browser-page-open')
        dismissForSelection()
        requestBrowserFocus({ pageId: activation.pageId, target: activation.focusTarget })
      } catch (error: unknown) {
        toast.error(error instanceof Error ? error.message : String(error))
      } finally {
        pending.current = false
        if (progress !== undefined) {
          toast.dismiss(progress)
        }
      }
    },
    [dismissForSelection, recordFeatureInteraction, requestBrowserFocus]
  )
  const handleSelectSimulatorTab = useCallback(
    async (result: SimulatorPaletteSearchResult) => {
      if (pending.current) {
        return
      }
      pending.current = true
      const progress = result.isHidden
        ? toast.loading(translate('tabs.hidden.waiting', 'Waiting for the host…'))
        : undefined
      try {
        const activation = await unhideAndActivateSimulatorTabPaletteResult(result)
        if (activation.status === 'blocked') {
          return
        }
        if (activation.status === 'failed') {
          toast.error(
            activation.reason === 'missing-tab'
              ? translate(
                  'auto.components.WorktreeJumpPalette.7726ce9970',
                  'Mobile emulator tab no longer exists'
                )
              : translate(
                  'auto.components.WorktreeJumpPalette.2c38630a01',
                  'Workspace no longer exists'
                )
          )
          return
        }
        dismissForSelection()
      } catch (error: unknown) {
        toast.error(error instanceof Error ? error.message : String(error))
      } finally {
        pending.current = false
        if (progress !== undefined) {
          toast.dismiss(progress)
        }
      }
    },
    [dismissForSelection]
  )
  const handleSelectWorkspaceTab = useCallback(
    async (result: WorkspaceTabPaletteSearchResult) => {
      if (pending.current) {
        return
      }
      pending.current = true
      const progress = result.isHidden
        ? toast.loading(translate('tabs.hidden.waiting', 'Waiting for the host…'))
        : undefined
      try {
        const activation = await unhideAndActivateWorkspaceTabPaletteResult(result)
        if (activation.status === 'blocked') {
          return
        }
        if (activation.status === 'failed') {
          toast.error(
            activation.reason === 'missing-worktree'
              ? translate(
                  'auto.components.WorktreeJumpPalette.2c38630a01',
                  'Workspace no longer exists'
                )
              : translate(
                  'auto.components.WorktreeJumpPalette.workspaceTabMissing',
                  'Tab no longer exists'
                )
          )
          return
        }
        dismissForSelection()
      } catch (error: unknown) {
        toast.error(error instanceof Error ? error.message : String(error))
      } finally {
        pending.current = false
        if (progress !== undefined) {
          toast.dismiss(progress)
        }
      }
    },
    [dismissForSelection]
  )
  return { handleSelectBrowserPage, handleSelectSimulatorTab, handleSelectWorkspaceTab }
}
