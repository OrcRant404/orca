import { expect, it, vi } from 'vitest'
import { readCrewWorkerMessages } from './crew-worker-message-read'
const rig = vi.hoisted(() => ({ read: vi.fn() }))
vi.mock('@/runtime/rpc/calls/runtime-rpc-call', () => ({ callRuntimeRpc: rig.read }))
it('preserves saved incoming and outgoing mail when a released CLI worker has no output archive', async () => {
  const full = 'Full saved detail '.repeat(150)
  const message = (id: string, from: string, body: string) => ({
    id,
    from_handle: from,
    to_handle: 'lead',
    body,
    subject: id,
    created_at: id
  })
  rig.read.mockImplementation(async (_target, method, params) => {
    if (method === 'orchestration.workerRead') {
      throw new Error('Released without an output archive')
    }
    return {
      messages:
        params.terminal === 'dispatch:d'
          ? [message('a', 'lead', full)]
          : [
              message('b', 'term-worker', 'Saved result'),
              message('c', 'different-worker', 'Exclude other worker')
            ]
    }
  })
  const result = await readCrewWorkerMessages(
    { kind: 'local' },
    { dispatchId: 'd', coordinatorAddress: 'term-lead', workerAddress: 'term-worker' }
  )
  expect(result.output).toBeNull()
  expect(result.messages.map((item) => item.id)).toEqual(['a', 'b'])
  expect(result.messages[0].body).toBe(full)
  expect(result.unavailable).toContain('Released without an output archive')
})
it('returns real terminal output independently when no coordination mail was saved', async () => {
  rig.read.mockImplementation(async (_target, method) =>
    method === 'orchestration.workerRead'
      ? { source: 'terminal', terminal: { tail: ['First line', 'Second line'] } }
      : { messages: [] }
  )
  const result = await readCrewWorkerMessages({ kind: 'local' }, { dispatchId: 'd' })
  expect(result.output).toBe('First line\nSecond line')
  expect(result.messages).toEqual([])
})
