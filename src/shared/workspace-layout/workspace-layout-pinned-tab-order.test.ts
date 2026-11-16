import { describe, expect, it } from 'vitest'
import { build, testContext, WS } from './workspace-layout-command.test-fixture'
import { loadWorkspaceLayout } from './workspace-layout-load'
import { saveWorkspaceLayout } from './workspace-layout-save'
import { emptyLayoutBeside } from './workspace-layout-model-rules'

function setup() {
  const context = testContext()
  const { model } = build(context, [
    { type: 'createTerminalTab', workspace: WS, tabId: 'pinned-a' },
    { type: 'createTerminalTab', workspace: WS, tabId: 'pinned-b' },
    { type: 'createTerminalTab', workspace: WS, tabId: 'ordinary' },
    { type: 'setTabProps', workspace: WS, tabId: 'pinned-a', isPinned: true },
    { type: 'setTabProps', workspace: WS, tabId: 'pinned-b', isPinned: true }
  ])
  return { context, model, groupId: model.workspaces[WS]!.groups[0]!.id }
}

describe('pinned tabs stay at the left edge of each group', () => {
  it.each([
    { tabId: 'ordinary', index: 0, expected: ['pinned-a', 'pinned-b', 'ordinary'] },
    { tabId: 'pinned-a', index: 2, expected: ['pinned-b', 'pinned-a', 'ordinary'] }
  ])('keeps $tabId inside its pin partition when moved to $index', ({ tabId, index, expected }) => {
    const { context, model, groupId } = setup()
    const moved = build(
      context,
      [{ type: 'moveTab', workspace: WS, tabId, toGroupId: groupId, index }],
      model
    ).model
    expect(moved.workspaces[WS]!.groups[0]!.tabOrder).toEqual(expected)
  })

  it('applies an atomic pin change before constraining the destination', () => {
    const { context, model, groupId } = setup()
    const moved = build(
      context,
      [
        {
          type: 'moveTab',
          workspace: WS,
          tabId: 'pinned-a',
          toGroupId: groupId,
          index: 0,
          isPinned: false
        }
      ],
      model
    ).model
    expect(moved.workspaces[WS]!.groups[0]!.tabOrder).toEqual(['pinned-b', 'pinned-a', 'ordinary'])
  })

  it('keeps hidden pinned tabs ahead of a move from a client that cannot see them', () => {
    const { context, model, groupId } = setup()
    const hidden = build(
      context,
      [{ type: 'setTabProps', workspace: WS, tabId: 'pinned-b', isHidden: true }],
      model
    ).model
    const moved = build(
      context,
      [
        {
          type: 'moveTab',
          workspace: WS,
          tabId: 'ordinary',
          toGroupId: groupId,
          index: 1,
          afterTabId: 'pinned-a'
        }
      ],
      hidden
    ).model
    expect(moved.workspaces[WS]!.groups[0]!.tabOrder).toEqual(['pinned-a', 'pinned-b', 'ordinary'])
  })

  it('inserts a pinned tab before ordinary tabs when moving between groups', () => {
    const { context, model, groupId } = setup()
    const split = build(
      context,
      [
        {
          type: 'splitGroup',
          workspace: WS,
          tabId: 'ordinary',
          besideGroupId: groupId,
          direction: 'right'
        }
      ],
      model
    )
    const moved = build(
      context,
      [
        {
          type: 'moveTab',
          workspace: WS,
          tabId: 'pinned-a',
          toGroupId: split.results[0]!.groupId!,
          index: 1
        }
      ],
      split.model
    ).model
    expect(moved.workspaces[WS]!.groups.map((group) => group.tabOrder)).toEqual([
      ['pinned-b'],
      ['pinned-a', 'ordinary']
    ])
  })

  it('repairs an older saved order and preserves the repaired order after another load', () => {
    const { model } = setup()
    const stored = saveWorkspaceLayout({ ...emptyLayoutBeside(), layout: model })
    stored.tabGroups![WS]![0]!.tabOrder = ['ordinary', 'pinned-b', 'pinned-a']
    const loaded = loadWorkspaceLayout(model.hostId, stored, testContext())
    expect(loaded.layout.workspaces[WS]!.groups[0]!.tabOrder).toEqual([
      'pinned-b',
      'pinned-a',
      'ordinary'
    ])
    const restored = loadWorkspaceLayout(model.hostId, saveWorkspaceLayout(loaded), testContext())
    expect(restored.layout.workspaces[WS]!.groups[0]!.tabOrder).toEqual([
      'pinned-b',
      'pinned-a',
      'ordinary'
    ])
  })
})
