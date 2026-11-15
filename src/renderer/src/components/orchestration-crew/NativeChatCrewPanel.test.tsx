// @vitest-environment happy-dom
import '@testing-library/jest-dom/vitest'
import { act, cleanup, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { useAppStore } from '@/store'
import { TooltipProvider } from '@/components/ui/tooltip'
import {
  emptyCrew,
  type OrchestrationCrewSnapshot
} from '../../../../shared/orchestration/orchestration-crew'
import { NativeChatCrewPanel } from './NativeChatCrewPanel'
import TeamSidebarPanel from './TeamSidebarPanel'

const source = vi.hoisted(() => new Map<string, OrchestrationCrewSnapshot>())
vi.mock('../native-chat/worker-lifetime/use-orchestration-crew', () => ({
  useOrchestrationCrew: (_target: unknown, party: string | null) => source.get(party ?? '') ?? EMPTY
}))
const EMPTY = emptyCrew('ok')
afterEach(() => {
  cleanup()
  source.clear()
  useAppStore.setState(useAppStore.getInitialState(), true)
})
it('scopes teams to the visible tabs and separates collapsible split-pane chains', () => {
  const snapshot = (label: string): OrchestrationCrewSnapshot => ({
    ...emptyCrew('ok'),
    sections: {
      managedBy: [],
      talkingWith: [],
      managing: [{ partyKey: label, role: 'worker', label, agentKind: 'codex', status: 'working' }]
    }
  })
  source.set('term_a', snapshot('Worker A'))
  source.set('term_b', snapshot('Worker B'))
  const groups = [{ id: 'left', activeTabId: 'a', tabOrder: ['a', 'b', 'plain'] }]
  useAppStore.setState({
    activeWorktreeId: 'workspace',
    activeGroupIdByWorktree: { workspace: 'left' },
    groupsByWorktree: { workspace: groups },
    unifiedTabsByWorktree: {
      workspace: [
        {
          id: 'a',
          label: 'Lead A',
          contentType: 'agent-session',
          entityId: 'session-a',
          groupId: 'left'
        },
        {
          id: 'b',
          label: 'Lead B',
          contentType: 'agent-session',
          entityId: 'session-b',
          groupId: 'left'
        },
        { id: 'plain', label: 'Plain', contentType: 'file', entityId: 'file', groupId: 'left' }
      ]
    }
  } as never)
  const props = {
    target: { kind: 'local' as const },
    composerRef: { current: null },
    canMention: false
  }
  render(
    <TooltipProvider>
      <NativeChatCrewPanel {...props} tabId="a" party="term_a" />
      <NativeChatCrewPanel {...props} tabId="b" party="term_b" />
      <TeamSidebarPanel />
    </TooltipProvider>
  )
  expect(screen.getByRole('button', { name: 'More for Worker A' })).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'More for Worker B' })).not.toBeInTheDocument()
  act(() =>
    useAppStore.setState({
      groupsByWorktree: { workspace: [{ ...groups[0], activeTabId: 'b' }] }
    } as never)
  )
  expect(screen.queryByRole('button', { name: 'More for Worker A' })).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'More for Worker B' })).toBeInTheDocument()
  act(() =>
    useAppStore.setState({
      unifiedTabsByWorktree: {
        workspace: useAppStore
          .getState()
          .unifiedTabsByWorktree.workspace.map((tab) =>
            tab.id === 'b' ? { ...tab, groupId: 'right' } : tab
          )
      },
      groupsByWorktree: {
        workspace: [groups[0], { id: 'right', activeTabId: 'b', tabOrder: ['b'] }]
      }
    } as never)
  )
  expect(screen.getByRole('button', { name: 'More for Worker A' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'More for Worker B' })).toBeInTheDocument()
  act(() =>
    useAppStore.setState({
      groupsByWorktree: { workspace: [{ ...groups[0], activeTabId: 'plain' }] }
    } as never)
  )
  expect(screen.queryByRole('button', { name: 'More for Worker B' })).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'More for Worker A' })).not.toBeInTheDocument()
})

it.each([
  'not-in-tab-order',
  'wrong-group',
  'hidden-group',
  'different-workspace',
  'closed-tab',
  'changed-session'
] as const)('does not show a team for a stale or unrelated pane: %s', async (scenario) => {
  source.set('term_a', {
    ...emptyCrew('ok'),
    sections: {
      managedBy: [],
      talkingWith: [],
      managing: [
        {
          partyKey: 'worker-a',
          role: 'worker',
          label: 'Worker A',
          agentKind: 'codex',
          status: 'done'
        }
      ]
    }
  })
  useAppStore.setState({
    activeWorktreeId: 'workspace',
    groupsByWorktree: { workspace: [{ id: 'left', activeTabId: 'a', tabOrder: ['a'] }] },
    unifiedTabsByWorktree: {
      workspace: [
        {
          id: 'a',
          groupId: 'left',
          label: 'Lead A',
          contentType: 'agent-session',
          entityId: 'new-session'
        }
      ]
    },
    layoutByWorktree: { workspace: { type: 'leaf', groupId: 'left' } }
  } as never)
  const view = render(
    <TooltipProvider>
      <NativeChatCrewPanel
        tabId="a"
        party="term_a"
        sessionId={scenario === 'changed-session' ? 'old-session' : 'new-session'}
        target={{ kind: 'local' }}
        composerRef={{ current: null }}
        canMention={false}
      />
      <TeamSidebarPanel />
    </TooltipProvider>
  )
  if (scenario !== 'changed-session') {
    expect(screen.getByRole('button', { name: 'More for Worker A' })).toBeInTheDocument()
  }
  act(() => {
    const state = useAppStore.getState()
    if (scenario === 'not-in-tab-order') {
      useAppStore.setState({
        groupsByWorktree: { workspace: [{ id: 'left', activeTabId: 'a', tabOrder: [] }] }
      } as never)
    }
    if (scenario === 'wrong-group') {
      useAppStore.setState({
        unifiedTabsByWorktree: {
          workspace: state.unifiedTabsByWorktree.workspace.map((tab) => ({
            ...tab,
            groupId: 'hidden'
          }))
        }
      })
    }
    if (scenario === 'hidden-group') {
      useAppStore.setState({
        layoutByWorktree: { workspace: { type: 'leaf', groupId: 'another' } }
      })
    }
    if (scenario === 'different-workspace') {
      useAppStore.setState({ activeWorktreeId: 'another-workspace' })
    }
    if (scenario === 'closed-tab') {
      useAppStore.setState({ unifiedTabsByWorktree: { workspace: [] } })
    }
  })
  expect(screen.queryByRole('button', { name: 'More for Worker A' })).not.toBeInTheDocument()
  view.unmount()
})

it('keeps the final registration across a rapid tab-id remount and does not leave the intermediate team behind', async () => {
  source.set('term_a', {
    ...emptyCrew('ok'),
    sections: {
      managedBy: [],
      talkingWith: [],
      managing: [
        {
          partyKey: 'worker-a',
          role: 'worker',
          label: 'Worker A',
          agentKind: 'codex',
          status: 'done'
        }
      ]
    }
  })
  useAppStore.setState({
    activeWorktreeId: 'workspace',
    groupsByWorktree: { workspace: [{ id: 'left', activeTabId: 'a', tabOrder: ['a'] }] },
    unifiedTabsByWorktree: {
      workspace: [
        {
          id: 'a',
          groupId: 'left',
          label: 'Lead A',
          contentType: 'agent-session',
          entityId: 'new-session'
        }
      ]
    }
  } as never)
  const content = (id: string) => (
    <TooltipProvider>
      <NativeChatCrewPanel
        tabId={id}
        party="term_a"
        target={{ kind: 'local' }}
        composerRef={{ current: null }}
        canMention={false}
      />
      <TeamSidebarPanel />
    </TooltipProvider>
  )
  const view = render(content('a'))
  view.rerender(content('b'))
  view.rerender(content('a'))
  await act(async () => {
    await Promise.resolve()
  })
  expect(screen.getByRole('button', { name: 'More for Worker A' })).toBeInTheDocument()
  act(() =>
    useAppStore.setState({
      groupsByWorktree: { workspace: [{ id: 'left', activeTabId: 'b', tabOrder: ['b'] }] },
      unifiedTabsByWorktree: {
        workspace: [
          {
            id: 'b',
            groupId: 'left',
            label: 'Intermediate',
            contentType: 'agent-session',
            entityId: 'other'
          }
        ]
      }
    } as never)
  )
  expect(screen.queryByRole('button', { name: 'More for Worker A' })).not.toBeInTheDocument()
})
