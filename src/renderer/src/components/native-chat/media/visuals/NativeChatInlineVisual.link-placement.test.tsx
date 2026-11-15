// @vitest-environment happy-dom
import type * as BrowserFocusModule from '@/components/browser-pane/host-guest/browser-focus'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { useAppStore } from '@/store'
import { NativeChatInlineVisual } from './NativeChatInlineVisual'
import { NativeChatVisualOwnerProvider, useNativeChatVisualOwner } from './native-chat-visual-owner'
import { TooltipProvider } from '@/components/ui/tooltip'
import {
  seedBrowserLinkTestStore,
  WORKSPACE
} from '@/lib/browser/navigation/browser-link-open.test-fixture'
import { createStoreCascadesMockApi } from '@/store/testing/app-store-cascade-api.test-fixture'

vi.mock('./use-native-chat-visual-document', () => ({
  useNativeChatVisualDocument: () => ({
    status: 'ready',
    document: { path: '/repo/chart.html', revision: '1', html: '<p>chart</p>' }
  })
}))
vi.mock('../images/native-chat-image-visibility', () => ({
  observeTranscriptVisibility: (_element: Element, visible: (value: boolean) => void) => {
    visible(true)
    return () => {}
  }
}))
vi.mock('@/components/browser-pane/host-guest/browser-focus', async (importOriginal) => ({
  ...(await importOriginal<typeof BrowserFocusModule>()),
  requestBrowserFocus: vi.fn()
}))
vi.mock('sonner', () => ({
  toast: { error: vi.fn(), info: vi.fn(), success: vi.fn(), warning: vi.fn() }
}))
const domWindow = window
const api = createStoreCascadesMockApi()
vi.stubGlobal('window', domWindow)
Object.defineProperty(domWindow, 'api', { value: api, configurable: true })

afterEach(cleanup)
beforeEach(() => {
  seedBrowserLinkTestStore(useAppStore)
  useAppStore.setState((state) => ({
    unifiedTabsByWorktree: {
      [WORKSPACE]: state.unifiedTabsByWorktree[WORKSPACE]!.map((tab) =>
        tab.id === 'source' ? { ...tab, contentType: 'agent-session' as const } : tab
      )
    }
  }))
})

function OwnedVisual() {
  const owner = useNativeChatVisualOwner()
  return owner ? <NativeChatInlineVisual owner={owner} file="chart.html" title="Chart" /> : null
}
function showVisual() {
  render(
    <TooltipProvider>
      <NativeChatVisualOwnerProvider target={{ kind: 'local' }} sessionId="session" tabId="source">
        <OwnedVisual />
      </NativeChatVisualOwnerProvider>
    </TooltipProvider>
  )
}
function wrapperForActiveBrowser() {
  const state = useAppStore.getState()
  return state.unifiedTabsByWorktree[WORKSPACE]?.find(
    (tab) => tab.entityId === state.activeBrowserTabIdByWorktree[WORKSPACE]
  )
}

it('opens in the moved source pane even when the exact page exists elsewhere', () => {
  const browser = useAppStore.getState().createBrowserTab(WORKSPACE, 'file:///repo/chart.html', {
    targetGroupId: 'c',
    executionHostId: 'local',
    browserRuntimeEnvironmentId: null,
    activate: false
  })
  useAppStore.getState().createBrowserPage(browser.id, 'https://other.example/', {
    activate: true,
    browserRuntimeEnvironmentId: null
  })
  showVisual()
  act(() => {
    useAppStore.setState((state) => ({
      unifiedTabsByWorktree: {
        [WORKSPACE]: state.unifiedTabsByWorktree[WORKSPACE]!.map((tab) =>
          tab.id === 'source' ? { ...tab, groupId: 'b' } : tab
        )
      }
    }))
  })
  fireEvent.click(screen.getByRole('button', { name: 'Open in new tab' }))
  expect(wrapperForActiveBrowser()?.entityId).not.toBe(browser.id)
  expect(wrapperForActiveBrowser()?.groupId).toBe('b')
})

it('opens to the adjacent pane even when the exact page exists in the source pane', () => {
  const state = useAppStore.getState()
  state.createBrowserTab(WORKSPACE, 'file:///repo/chart.html', {
    targetGroupId: 'a',
    executionHostId: 'local',
    browserRuntimeEnvironmentId: null,
    activate: false
  })
  const sideBrowser = state.createBrowserTab(WORKSPACE, 'file:///repo/chart.html', {
    targetGroupId: 'b',
    executionHostId: 'local',
    browserRuntimeEnvironmentId: null,
    activate: false
  })
  state.createBrowserPage(sideBrowser.id, 'https://other.example/', {
    activate: true,
    browserRuntimeEnvironmentId: null
  })
  showVisual()
  fireEvent.click(screen.getByRole('button', { name: 'Open to side' }))
  expect(wrapperForActiveBrowser()?.entityId).toBe(sideBrowser.id)
  expect(wrapperForActiveBrowser()?.groupId).toBe('b')
  expect(
    useAppStore
      .getState()
      .browserTabsByWorktree[WORKSPACE]?.find((tab) => tab.id === sideBrowser.id)?.activePageId
  ).toBe(sideBrowser.activePageId)
})

it('opens a right split from one pane instead of reusing its exact page', () => {
  useAppStore.setState((state) => ({
    groupsByWorktree: {
      [WORKSPACE]: state.groupsByWorktree[WORKSPACE]!.filter((group) => group.id === 'a')
    },
    unifiedTabsByWorktree: {
      [WORKSPACE]: state.unifiedTabsByWorktree[WORKSPACE]!.filter((tab) => tab.groupId === 'a')
    },
    activeGroupIdByWorktree: { [WORKSPACE]: 'a' },
    layoutByWorktree: { [WORKSPACE]: { type: 'leaf', groupId: 'a' } }
  }))
  const sourceBrowser = useAppStore
    .getState()
    .createBrowserTab(WORKSPACE, 'file:///repo/chart.html', {
      targetGroupId: 'a',
      executionHostId: 'local',
      browserRuntimeEnvironmentId: null,
      activate: false
    })
  showVisual()
  fireEvent.click(screen.getByRole('button', { name: 'Open to side' }))
  expect(wrapperForActiveBrowser()?.entityId).not.toBe(sourceBrowser.id)
  expect(wrapperForActiveBrowser()?.groupId).not.toBe('a')
  expect(useAppStore.getState().layoutByWorktree[WORKSPACE]).toMatchObject({
    type: 'split',
    direction: 'horizontal',
    first: { type: 'leaf', groupId: 'a' },
    second: { type: 'leaf', groupId: expect.any(String) }
  })
})
