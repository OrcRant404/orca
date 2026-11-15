import { describe, expect, it } from 'vitest'
import type { RuntimeMobileSessionTabsResult } from '../../../../../shared/runtime-session-contracts'
import { visibleSnapshot } from './session-tabs-snapshot.test-fixture'
import { projectSessionTabBrowserPlacements } from './session-tab-browser-placement-projection'

function snapshot(): RuntimeMobileSessionTabsResult {
  return {
    ...visibleSnapshot(),
    activeGroupId: 'selected-group',
    activeTabId: null,
    activeTabType: null,
    tabGroups: [
      { id: 'other-group', activeTabId: 'other', tabOrder: ['other'] },
      {
        id: 'selected-group',
        activeTabId: null,
        tabOrder: ['selected', 'filtered'],
        recentTabIds: ['selected', 'filtered']
      }
    ],
    tabs: [
      {
        type: 'terminal',
        id: 'other::leaf',
        parentTabId: 'other',
        leafId: 'leaf',
        title: 'Other',
        status: 'ready',
        terminal: 'other-pty',
        isActive: false
      },
      {
        type: 'terminal',
        id: 'selected::leaf',
        parentTabId: 'selected',
        leafId: 'leaf',
        title: 'Selected',
        status: 'pending-handle',
        terminal: null,
        isActive: false,
        isHidden: true
      },
      {
        type: 'browser',
        id: 'filtered',
        title: 'Client browser',
        browserWorkspaceId: 'filtered',
        browserPageId: 'page',
        url: 'about:blank',
        loading: false,
        canGoBack: false,
        canGoForward: false,
        isActive: false,
        placement: {
          kind: 'client',
          browserHostClientId: 'desktop',
          browserHostGeneration: 1,
          pageHostGeneration: 1
        }
      }
    ]
  }
}

describe('session tab compatibility selection', () => {
  it('preserves null selection and hidden membership when filtering a browser, including after unhide', () => {
    const hidden = snapshot()
    const projected = projectSessionTabBrowserPlacements(hidden, [])
    expect(projected.activeTabId).toBeNull()
    expect(projected.activeTabType).toBeNull()
    expect(projected.tabGroups).toEqual([
      { id: 'other-group', activeTabId: 'other', tabOrder: ['other'] },
      {
        id: 'selected-group',
        activeTabId: null,
        tabOrder: ['selected'],
        recentTabIds: ['selected']
      }
    ])
    expect(projected.tabs.map((tab) => tab.id)).toEqual(['other::leaf', 'selected::leaf'])

    const restored = projectSessionTabBrowserPlacements(
      {
        ...hidden,
        tabs: hidden.tabs.map((tab) =>
          tab.id === 'selected::leaf' ? { ...tab, isHidden: false } : tab
        )
      },
      []
    )
    expect(restored.activeTabId).toBeNull()
    expect(restored.tabs.map((tab) => tab.isActive)).toEqual([false, false])
  })

  it('replaces a filtered active tab only with a visible candidate in its selected group', () => {
    const source = snapshot()
    source.activeTabId = 'filtered'
    source.activeTabType = 'browser'
    source.tabGroups![1]!.activeTabId = 'filtered'
    source.tabGroups![1]!.tabOrder.push('fallback')
    source.tabs.push({
      type: 'terminal',
      id: 'fallback::leaf',
      parentTabId: 'fallback',
      leafId: 'leaf',
      title: 'Fallback',
      status: 'ready',
      terminal: 'fallback-pty',
      isActive: false
    })

    const projected = projectSessionTabBrowserPlacements(source, [])
    expect(projected.activeGroupId).toBe('selected-group')
    expect(projected.activeTabId).toBe('fallback::leaf')
    expect(projected.tabGroups![1]).toMatchObject({
      activeTabId: 'fallback',
      tabOrder: ['selected', 'fallback']
    })
    expect(projected.tabs.map((tab) => tab.isActive)).toEqual([false, false, true])
  })

  it('clears a removed active tab when its group has only hidden candidates', () => {
    const source = snapshot()
    source.activeTabId = 'filtered'
    source.activeTabType = 'browser'
    source.tabGroups![1]!.activeTabId = 'filtered'

    const projected = projectSessionTabBrowserPlacements(source, [])
    expect(projected.activeGroupId).toBe('selected-group')
    expect(projected.activeTabId).toBeNull()
    expect(projected.tabGroups![1]).toMatchObject({
      activeTabId: null,
      tabOrder: ['selected']
    })
    expect(projected.tabs.map((tab) => tab.isActive)).toEqual([false, false])
  })
})
