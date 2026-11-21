import { describe, expect, it, vi } from 'vitest'
import { executePluginHostCall, type PluginHostServices } from './plugin-host-methods'

function createServices(storageSet: PluginHostServices['storage']['set']): PluginHostServices {
  return {
    resolveActiveWorktreeContext: vi.fn().mockResolvedValue(null),
    listWorktreeTerminals: vi.fn().mockResolvedValue([]),
    sendTerminalText: vi.fn().mockResolvedValue({ accepted: true }),
    listAgentStatuses: () => [],
    dispatchPluginNotification: vi.fn().mockResolvedValue({ delivered: true }),
    storage: {
      get: vi.fn(),
      set: storageSet,
      delete: vi.fn(),
      keys: vi.fn().mockReturnValue([])
    },
    secrets: {
      get: vi.fn().mockReturnValue({ ok: true, value: null }),
      set: vi.fn().mockReturnValue({ ok: true }),
      delete: vi.fn(),
      protection: vi.fn().mockReturnValue('unavailable')
    },
    settings: {
      getAll: vi.fn().mockReturnValue({}),
      set: vi.fn().mockReturnValue({ ok: true })
    }
  }
}

describe('executePluginHostCall mutation auditing', () => {
  it('fails closed before a mutation when the audit intent cannot be recorded', async () => {
    const storageSet = vi.fn().mockReturnValue({ ok: true })
    const outcome = await executePluginHostCall({
      pluginId: 'samples.demo',
      method: 'storage.set',
      params: { key: 'answer', value: 42 },
      surface: 'worker',
      grantedCapabilities: ['storage:own'],
      services: createServices(storageSet),
      audit: { record: vi.fn().mockRejectedValue(new Error('disk full')) }
    })

    expect(outcome).toMatchObject({ ok: false, code: 'action_failed' })
    expect(storageSet).not.toHaveBeenCalled()
  })
})

describe('workspace.readContext host reachability', () => {
  it('keeps the active remote context when its host cannot list terminals', async () => {
    const services = createServices(vi.fn())
    vi.mocked(services.resolveActiveWorktreeContext).mockResolvedValue({
      worktreeId: 'remote-repo::/home/user/repo',
      path: '/home/user/repo',
      branch: '',
      displayName: 'Remote main'
    })
    vi.mocked(services.listWorktreeTerminals).mockRejectedValue(new Error('host_unreachable'))

    const outcome = await executePluginHostCall({
      pluginId: 'samples.demo',
      method: 'workspace.readContext',
      params: {},
      surface: 'panel',
      grantedCapabilities: ['workspace:read'],
      services
    })

    expect(outcome).toMatchObject({
      ok: true,
      value: { branch: '', displayName: 'Remote main', terminals: [] }
    })
  })
})

describe('workspace.list focus', () => {
  it('includes the focused path even when two workspace labels and branches match', async () => {
    const services = createServices(vi.fn())
    vi.mocked(services.resolveActiveWorktreeContext).mockResolvedValue({
      worktreeId: 'second-repo::/second/main',
      path: '/second/main',
      branch: 'refs/heads/main',
      displayName: 'main'
    })
    services.runtimeRpc = vi.fn(async (method) => {
      if (method === 'worktree.list') {
        return {
          worktrees: [
            {
              id: 'first-repo::/first/main',
              repoId: 'first-repo',
              path: '/first/main',
              displayName: 'main',
              branch: 'refs/heads/main'
            },
            {
              id: 'second-repo::/second/main',
              repoId: 'second-repo',
              path: '/second/main',
              displayName: 'main',
              branch: 'refs/heads/main'
            }
          ],
          totalCount: 2
        }
      }
      if (method === 'repo.list') {
        return { repos: [] }
      }
      return { folderWorkspaces: [] }
    })
    const outcome = await executePluginHostCall({
      pluginId: 'samples.demo',
      method: 'workspace.list',
      params: {},
      surface: 'worker',
      grantedCapabilities: ['workspace:read'],
      services
    })
    expect(outcome).toMatchObject({ ok: true, value: { focusedPath: '/second/main' } })
  })
})
