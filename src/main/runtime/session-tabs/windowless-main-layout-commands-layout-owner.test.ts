// Layout-owner build, no window: a CLI close, rename or pane title, and a phone's tab props or pane
// names, of a workspace main owns are each main's own layout command, published as one frame.
import { describe, expect, it, vi } from 'vitest'
import type { WorkspaceLayoutStreamEvent } from '../../../shared/workspace-layout/workspace-layout-stream-frames'
import { RpcDispatcher } from '../rpc/dispatcher'
import { SESSION_TAB_MUTATION_METHODS } from '../rpc/methods/session-tabs/session-tab-mutation-methods'
import {
  LEAF_A,
  LEAF_B,
  PTY_A,
  TAB_ID,
  WORKTREE_ID,
  setupMainOwnedWorkspace
} from '../terminal/layout/main-owned-workspace-runtime-fixture'

vi.mock('../../../shared/layout-owner-switch', () => ({ ORCA_LAYOUT_OWNER_IS_MAIN: true }))

/** Runs one operation and counts the layout frames it published. */
async function framesOf(
  fixture: ReturnType<typeof setupMainOwnedWorkspace>,
  operation: () => Promise<unknown>
): Promise<number> {
  const before = fixture.frames()
  await operation()
  await Promise.resolve()
  return fixture.frames() - before
}

const tabRow = (fixture: ReturnType<typeof setupMainOwnedWorkspace>) =>
  fixture.session().tabsByWorktree[WORKTREE_ID]?.find((tab) => tab.id === TAB_ID)

describe('CLI terminal commands on a workspace main owns, with no window', () => {
  it('closes the tab in one frame', async () => {
    const fixture = setupMainOwnedWorkspace()
    const handle = fixture.handleOf(PTY_A)

    expect(await framesOf(fixture, () => fixture.runtime.closeTerminalTab(handle))).toBe(1)

    expect(tabRow(fixture)).toBeUndefined()
    expect(fixture.stopped).toEqual([PTY_A])
  })
})

describe("a phone's tab props and pane names on a workspace main owns, with no window", () => {
  it('hides the canonical terminal and publishes it when the phone addresses a raw pane row', async () => {
    const { runtime, session } = setupMainOwnedWorkspace()
    const initial = await runtime.listMobileSessionTabs(`id:${WORKTREE_ID}`)
    const terminal = initial.tabs.find((tab) => tab.type === 'terminal')
    expect(terminal?.id).toBe('tab-1::11111111-1111-4111-8111-111111111111')
    if (!terminal) {
      throw new Error('Expected the actual terminal row')
    }
    const frames: WorkspaceLayoutStreamEvent[] = []
    const subscription = runtime.subscribeWorkspaceLayouts((frame) => frames.push(frame))
    const dispatcher = new RpcDispatcher({ runtime, methods: SESSION_TAB_MUTATION_METHODS })
    try {
      const reply = await dispatcher.dispatch(
        {
          id: 'phone-hide-pane-row',
          authToken: 'phone',
          method: 'session.tabs.setTabProps',
          params: {
            worktree: `id:${WORKTREE_ID}`,
            tabId: terminal.id,
            isHidden: true,
            color: 'blue',
            isPinned: true,
            viewMode: 'chat'
          }
        },
        { clientKind: 'mobile', pairedDeviceId: 'phone' }
      )
      expect(reply).toMatchObject({ ok: true, result: { updated: true, forwarded: false } })
      expect(session().unifiedTabs?.[WORKTREE_ID]?.find((tab) => tab.id === 'tab-1')).toMatchObject(
        {
          isHidden: true,
          color: 'blue',
          isPinned: true,
          viewMode: 'chat'
        }
      )
      expect(
        frames.flatMap((frame) =>
          frame.type === 'records'
            ? frame.workspaces.flatMap((change) =>
                change.change === 'records'
                  ? (change.tabs?.set ?? [])
                  : change.change === 'layout'
                    ? change.layout.tabs
                    : []
              )
            : frame.type === 'workspace'
              ? frame.layout.tabs
              : []
        )
      ).toContainEqual(expect.objectContaining({ id: 'tab-1', isHidden: true }))
      expect((await runtime.listMobileSessionTabs(`id:${WORKTREE_ID}`)).tabs).toContainEqual(
        expect.objectContaining({
          id: 'tab-1::11111111-1111-4111-8111-111111111111',
          parentTabId: 'tab-1',
          isHidden: true
        })
      )
    } finally {
      subscription.unsubscribe()
    }
  })

  it('names only the panes the phone says it renamed', async () => {
    const fixture = setupMainOwnedWorkspace({ split: true })
    const root = fixture.session().terminalLayoutsByTabId[TAB_ID]!.root

    await fixture.runtime.updateMobileSessionPaneLayout(`id:${WORKTREE_ID}`, {
      tabId: TAB_ID,
      root,
      expandedLeafId: null,
      titlesByLeafId: { [LEAF_A]: 'Stale', [LEAF_B]: 'Server' },
      renamedLeafIds: [LEAF_B]
    })

    expect(fixture.session().terminalLayoutsByTabId[TAB_ID]?.titlesByLeafId).toEqual({
      [LEAF_B]: 'Server'
    })
  })
})
