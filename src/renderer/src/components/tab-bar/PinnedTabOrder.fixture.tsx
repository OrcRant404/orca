import { DndContext } from '@dnd-kit/core'
import { defineFixture } from '../../component-fixtures/component-fixture'
import type { TerminalTab } from '../../../../shared/workspace-layout/terminal-tab-types'
import { useAppStore } from '../../store'
import TabBar from './TabBar'

const WORKSPACE_ID = 'pinned-tab-order-fixture'
const GROUP_ID = 'pinned-tab-group'
const tabs: TerminalTab[] = ['Ordinary A', 'Ordinary B', 'Pinned A', 'Pinned B'].map(
  (title, index) => ({
    id: `tab-${index}`,
    worktreeId: WORKSPACE_ID,
    title,
    ptyId: null,
    customTitle: null,
    color: null,
    sortOrder: index,
    createdAt: 0
  })
)
const noop = (): void => {}

function PinnedTabsFixture(): React.JSX.Element {
  const tabBarOrder = useAppStore((state) => state.groupsByWorktree[WORKSPACE_ID]?.[0]?.tabOrder)
  return (
    <DndContext>
      <div className="@container/tab-strip h-8 bg-tab-bar">
        <TabBar
          tabs={tabs}
          activeTabId="tab-3"
          activeTabType="terminal"
          worktreeId={WORKSPACE_ID}
          groupId={GROUP_ID}
          tabBarOrder={tabBarOrder}
          expandedPaneByTabId={{}}
          showAgentLaunchItems={false}
          onActivate={noop}
          onClose={noop}
          onCloseOthers={noop}
          onCloseToRight={noop}
          onCloseToLeft={noop}
          onNewTerminalTab={noop}
          onNewBrowserTab={noop}
          onSetCustomTitle={noop}
          onSetTabColor={noop}
          onTogglePaneExpand={noop}
        />
      </div>
    </DndContext>
  )
}

export const pinnedFirst = defineFixture({
  width: 900,
  store: {
    unifiedTabsByWorktree: {
      [WORKSPACE_ID]: tabs.map((tab, index) => ({
        id: tab.id,
        entityId: tab.id,
        worktreeId: WORKSPACE_ID,
        groupId: GROUP_ID,
        contentType: 'terminal',
        label: tab.title,
        customLabel: null,
        color: null,
        sortOrder: index,
        createdAt: 0,
        isPinned: index >= 2
      }))
    },
    groupsByWorktree: {
      [WORKSPACE_ID]: [
        {
          id: GROUP_ID,
          worktreeId: WORKSPACE_ID,
          activeTabId: 'tab-3',
          tabOrder: ['tab-0', 'tab-1', 'tab-2', 'tab-3']
        }
      ]
    }
  },
  setup: () =>
    useAppStore.getState().reorderUnifiedTabs(GROUP_ID, ['tab-1', 'tab-3', 'tab-0', 'tab-2'], {
      layoutOwnerHandled: true,
      recordInteraction: false
    }),
  render: () => <PinnedTabsFixture />
})

export const narrow = defineFixture({ ...pinnedFirst, width: 420 })
