// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { afterEach, expect, it, vi } from 'vitest'
import { FLOATING_TERMINAL_WORKTREE_ID } from '../../../shared/constants'
import { createGlobalSettingsFixture } from '../../../shared/global-settings-test-fixture'
import { TOGGLE_FLOATING_TERMINAL_EVENT } from '@/lib/floating-terminal'
import { useAppStore } from '@/store'
import { makeTab } from '@/store/terminals/terminal-tab.test-fixture'
import { makeUnifiedTab } from '@/store/slices/tabs/tab-group.test-fixture'
import { AppRootSurfaces } from './AppRootSurfaces'
import { useFloatingWorkspacePanel } from './use-floating-workspace-panel'
import type { OnboardingGate } from './use-onboarding-and-feature-tips'

// Keep the actual root mount owner; replace unrelated surfaces and the expensive pane payload.
vi.mock('../components/floating-terminal/FloatingTerminalPanel', () => ({
  FloatingTerminalPanel: function RetainedPane({ open }: { open: boolean }) {
    const [draft, setDraft] = useState('')
    return (
      <div hidden={!open}>
        <textarea
          aria-label="Floating pane draft"
          value={draft}
          onChange={(event) => setDraft(event.currentTarget.value)}
        />
      </div>
    )
  }
}))
vi.mock('../components/crash-report/CrashReportDialog', () => ({ CrashReportDialog: () => null }))
vi.mock('../components/editor/markdown/documents/MarkdownTemplatePicker', () => ({
  MarkdownTemplatePicker: () => null
}))
vi.mock('../components/tab-bar/RecentTabSwitcher', () => ({ default: () => null }))
vi.mock('../components/skills/SkillFreshnessUpdateDialog', () => ({
  SkillFreshnessUpdateDialog: () => null
}))
vi.mock('../components/star-nag/StarNagAgentValueMomentObserver', () => ({
  StarNagAgentValueMomentObserver: () => null
}))
vi.mock('../components/NativeChatResumeRuntimeModal', () => ({
  NativeChatResumeOnRestartModal: () => null
}))
vi.mock('../components/star-nag/StarNagToastHost', () => ({ StarNagToastHost: () => null }))
vi.mock('../components/TelemetryFirstLaunchSurface', () => ({
  TelemetryFirstLaunchSurface: () => null
}))
vi.mock('../components/ZoomOverlay', () => ({ ZoomOverlay: () => null }))
vi.mock('../components/wsl-move/WslMoveDialog', () => ({ WslMoveDialogHost: () => null }))
vi.mock('../components/macos-update-requirement/MacosUpdateRequirementHost', () => ({
  MacosUpdateRequirementHost: () => null
}))
vi.mock('../components/settings/runtime-environments/updates/RemoteServerUpdateDialog', () => ({
  default: () => null
}))
vi.mock('./AppNotificationCards', () => ({ AppNotificationCards: () => null }))
vi.mock('./worktree-jump-palette-preload', () => ({
  usePreloadWorktreeJumpPalette: () => {},
  WorktreeJumpPalette: () => null
}))

const initialState = useAppStore.getState()
const onboardingGate: OnboardingGate = {
  applyStartupOnboardingState: () => {},
  onboarding: null,
  setOnboarding: () => {},
  shouldRender: false,
  chatUiHereCornerCardOpen: false,
  setChatUiHereCornerCardOpen: () => {}
}
const workspaceId = FLOATING_TERMINAL_WORKTREE_ID
function RootSurfaces() {
  return (
    <AppRootSurfaces
      floatingWorkspace={useFloatingWorkspacePanel()}
      onboardingGate={onboardingGate}
    />
  )
}
function seedWorkspace({ open = true, backed = true, hidden = false } = {}) {
  useAppStore.setState({
    ...initialState,
    settings: createGlobalSettingsFixture({ floatingTerminalEnabled: true }),
    floatingWorkspacePanelOpen: open,
    floatingWorkspacePath: '/floating',
    statusBarVisible: false,
    persistedUIReady: false,
    activeModal: 'none',
    activeContextualTourId: null,
    unifiedTabsByWorktree: {
      [workspaceId]: [
        makeUnifiedTab({
          id: 'floating-tab',
          entityId: 'terminal',
          worktreeId: workspaceId,
          groupId: 'group',
          isHidden: hidden
        })
      ]
    },
    tabsByWorktree: {
      [workspaceId]: backed ? [makeTab({ id: 'terminal', worktreeId: workspaceId })] : []
    },
    browserTabsByWorktree: {},
    openFiles: [],
    groupsByWorktree: {
      [workspaceId]: [
        {
          id: 'group',
          worktreeId: workspaceId,
          activeTabId: hidden ? null : 'floating-tab',
          tabOrder: ['floating-tab']
        }
      ]
    },
    layoutByWorktree: { [workspaceId]: { type: 'leaf', groupId: 'group' } },
    activeGroupIdByWorktree: { [workspaceId]: 'group' }
  })
}
function publishHiddenTab() {
  act(() =>
    useAppStore.setState((state) => ({
      unifiedTabsByWorktree: {
        ...state.unifiedTabsByWorktree,
        [workspaceId]: state.unifiedTabsByWorktree[workspaceId].map((tab) => ({
          ...tab,
          isHidden: true
        }))
      },
      groupsByWorktree: {
        ...state.groupsByWorktree,
        [workspaceId]: state.groupsByWorktree[workspaceId].map((group) => ({
          ...group,
          activeTabId: null
        }))
      }
    }))
  )
}
function togglePanel() {
  act(() => window.dispatchEvent(new Event(TOGGLE_FLOATING_TERMINAL_EVENT)))
}
afterEach(() => {
  cleanup()
  useAppStore.setState(initialState, true)
})

it('retains the pane and its draft across hide-all, minimize and reopen', async () => {
  seedWorkspace()
  render(<RootSurfaces />)
  const pane = await screen.findByLabelText('Floating pane draft')
  fireEvent.change(pane, { target: { value: 'unfinished session input' } })
  publishHiddenTab()
  togglePanel()
  expect(screen.getByLabelText('Floating pane draft')).toBe(pane)
  togglePanel()
  expect(screen.getByLabelText('Floating pane draft')).toBe(pane)
  expect(pane).toHaveProperty('value', 'unfinished session input')
})

it('retains the minimized pane when a publication hides its last visible tab', async () => {
  seedWorkspace()
  render(<RootSurfaces />)
  const pane = await screen.findByLabelText('Floating pane draft')
  fireEvent.change(pane, { target: { value: 'remote hide keeps this input' } })
  togglePanel()
  publishHiddenTab()
  expect(screen.getByLabelText('Floating pane draft')).toBe(pane)
  togglePanel()
  expect(screen.getByLabelText('Floating pane draft')).toBe(pane)
  expect(pane).toHaveProperty('value', 'remote hide keeps this input')
})

it('releases empty, unbacked and disabled panels instead of retaining stale membership', async () => {
  seedWorkspace({ open: false, backed: false, hidden: true })
  render(<RootSurfaces />)
  expect(screen.queryByLabelText('Floating pane draft')).toBeNull()
  togglePanel()
  const emptyPane = await screen.findByLabelText('Floating pane draft')
  fireEvent.change(emptyPane, { target: { value: 'empty pane input' } })
  togglePanel()
  expect(screen.queryByLabelText('Floating pane draft')).toBeNull()
  act(() => seedWorkspace({ hidden: true }))
  const backedPane = await screen.findByLabelText('Floating pane draft')
  expect(backedPane).not.toBe(emptyPane)
  fireEvent.change(backedPane, { target: { value: 'closed by disabling' } })
  act(() =>
    useAppStore.setState((state) => ({
      settings: state.settings && { ...state.settings, floatingTerminalEnabled: false }
    }))
  )
  expect(screen.queryByLabelText('Floating pane draft')).toBeNull()
  act(() =>
    useAppStore.setState((state) => ({
      settings: state.settings && { ...state.settings, floatingTerminalEnabled: true }
    }))
  )
  togglePanel()
  const restoredPane = await screen.findByLabelText('Floating pane draft')
  expect(restoredPane).not.toBe(backedPane)
  expect(restoredPane).toHaveProperty('value', '')
  togglePanel()
  act(() =>
    useAppStore.setState({
      unifiedTabsByWorktree: { [workspaceId]: [] },
      tabsByWorktree: { [workspaceId]: [] }
    })
  )
  expect(screen.queryByLabelText('Floating pane draft')).toBeNull()
})
