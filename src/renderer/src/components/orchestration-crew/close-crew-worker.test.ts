import { expect, it, vi } from 'vitest'
import { closeCrewWorker } from './use-close-crew-worker'
import type { OrchestrationCrewRow } from '../../../../shared/orchestration/orchestration-crew'
const row: OrchestrationCrewRow = {
  partyKey: 'worker',
  role: 'worker',
  label: 'Review worker',
  agentKind: 'codex',
  status: 'done',
  dispatchId: 'dispatch-a',
  retained: true,
  ownership: 'external',
  openTarget: { kind: 'chat', sessionId: 'session-a', worktreeId: 'workspace' }
}
type Call = Parameters<typeof closeCrewWorker>[1]
it('closes the exact adopted native chat and preserves the other worker', async () => {
  const open = new Set(['session-a', 'session-b'])
  const call = (async (method: string, params: { sessionId?: string }) => {
    if (method === 'orchestration.workerShow') {
      return { observation: { exactWorker: true } }
    }
    if (method === 'agentSession.close') {
      open.delete(params.sessionId!)
      return { ok: true }
    }
    throw new Error('Unexpected mutation')
  }) as Call
  await closeCrewWorker(row, call)
  expect([...open]).toEqual(['session-b'])
})
it('refuses a changed or unverifiable terminal instead of closing its replacement', async () => {
  let closed = false
  const call = (async (method: string) => {
    if (method === 'orchestration.workerShow') {
      return { observation: { exactWorker: false } }
    }
    closed = true
    return {}
  }) as Call
  await expect(
    closeCrewWorker({ ...row, openTarget: { kind: 'terminal', handle: 'term-old' } }, call)
  ).rejects.toThrow('cannot verify')
  expect(closed).toBe(false)
})
it('reports an unconfirmed owned-worker stop without claiming success', async () => {
  const call = vi.fn(async (method: string) =>
    method === 'orchestration.workerShow'
      ? { observation: { exactWorker: true } }
      : { state: 'stop_unknown', lastError: 'Host lost contact' }
  ) as Call
  await expect(
    closeCrewWorker({ ...row, retained: false, ownership: 'owned' }, call)
  ).rejects.toThrow('Host lost contact')
})
it('requires a confirmed CLI process stop before cleanup', async () => {
  let released = false
  const call = (async (method: string) => {
    if (method === 'orchestration.workerShow') {
      return { observation: { exactWorker: true } }
    }
    if (method === 'terminal.close') {
      return { close: { ptyKilled: false, ptyStopVerdict: 'unverifiable' } }
    }
    released = true
    return {}
  }) as Call
  await expect(
    closeCrewWorker({ ...row, openTarget: { kind: 'terminal', handle: 'term-a' } }, call)
  ).rejects.toThrow('did not close')
  expect(released).toBe(false)
})

it('cleans up an adopted native chat even when its idle provider process is no longer observable', async () => {
  const open = new Set(['session-a', 'session-b'])
  const call = (async (method: string, params: { sessionId?: string }) => {
    if (method === 'agentSession.close') {
      open.delete(params.sessionId!)
      return { ok: true }
    }
    throw new Error('Provider process is unobservable')
  }) as Call
  await closeCrewWorker(row, call)
  expect([...open]).toEqual(['session-b'])
})
