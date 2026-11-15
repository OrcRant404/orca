import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { getWorkerTerminalAutoReleaseScheduler } from '../../../../orchestration/terminal-authority/release/worker-terminal-auto-release-scheduler'
import {
  getFollowUpDispatch,
  markUnreadFollowUpMail
} from '../../../../orchestration/db/dispatch-context/worker-follow-up-lineage'
import './worker-resume-session-capture'
import {
  continueAllUnreadWorkerMail,
  continueUnreadWorkerMail
} from '../messaging/settled-worker-follow-through'
import { createOrchestrationWorkerReleaseHarness } from './worker-release.test-support'

// A send to a finished terminal worker, through the same worker-start the coordinator would run.
describe('a follow-up to a finished terminal worker', () => {
  const h = createOrchestrationWorkerReleaseHarness()
  let userDataDir: string | undefined

  afterEach(() => {
    getWorkerTerminalAutoReleaseScheduler(h.runtime).clear()
    h.cleanup()
    if (userDataDir) {
      rmSync(userDataDir, { recursive: true, force: true })
      userDataDir = undefined
    }
  })

  const send = (dispatchId: string, body: string) =>
    h.call('orchestration.send', {
      from: 'term_coord',
      to: `dispatch:${dispatchId}`,
      subject: 'More',
      body
    })

  it('retries a follow-up a restart interrupted before it placed an agent, with the mail it took', async () => {
    userDataDir = mkdtempSync(join(tmpdir(), 'orca-follow-up-midstart-'))
    h.setup({ userDataDir })
    const { taskId, dispatchId } = await h.startWorker()
    await send(dispatchId, 'DO NOT PUSH')
    h.settle(taskId, dispatchId, 'succeeded')
    // The claim commits; the app quits before the start places an agent.
    const claimed = h.db.createStartingWorkerDispatch({
      creator: { kind: 'system' },
      maxDepth: 9,
      taskSpec: 'New messages',
      taskRunId: h.activeRunId,
      startOptions: { agent: 'codex' },
      runtimeEpoch: 'runtime_before_restart',
      followUpOf: dispatchId,
      takesMailOf: dispatchId
    }).dispatch.id

    h.restart()

    await vi.waitFor(() => expect(getFollowUpDispatch(h.db, claimed)).toBeDefined())
    const retry = getFollowUpDispatch(h.db, claimed)!
    await vi.waitFor(() =>
      expect(h.db.getUnreadMessages(`dispatch:${retry.id}`)).toMatchObject([
        { body: 'DO NOT PUSH' }
      ])
    )
  })

  it('keeps the mail a stopped follow-up never read for the next send, without restarting it', async () => {
    h.setup()
    const { taskId, dispatchId } = await h.startWorker()
    await send(dispatchId, 'DO NOT PUSH')
    h.settle(taskId, dispatchId, 'succeeded')
    continueAllUnreadWorkerMail(h.runtime, h.db)
    await vi.waitFor(() =>
      expect(h.db.getWorkerDispatch(getFollowUpDispatch(h.db, dispatchId)?.id ?? '')?.state).toBe(
        'ready'
      )
    )
    const stopped = getFollowUpDispatch(h.db, dispatchId)!.id
    h.db.beginWorkerStop(stopped, h.runtime.getRuntimeId())
    h.db.settleWorkerStop(stopped)

    continueAllUnreadWorkerMail(h.runtime, h.db)
    expect(getFollowUpDispatch(h.db, stopped)).toBeUndefined()

    await send(dispatchId, 'and the docs')
    const next = getFollowUpDispatch(h.db, stopped)!
    await vi.waitFor(() =>
      expect(h.db.getUnreadMessages(`dispatch:${next.id}`)).toMatchObject([{ body: 'DO NOT PUSH' }])
    )
  })

  it('keeps the mail a failed follow-up took when a replayed report ran during its start', async () => {
    h.setup()
    const { taskId, dispatchId } = await h.startWorker()
    await send(dispatchId, 'DO NOT PUSH')
    h.settle(taskId, dispatchId, 'succeeded')
    vi.mocked(h.runtime.sendTerminalAgentPrompt).mockImplementationOnce(async () => {
      // The replay finds no unread mail, since the start took it, and clears the marker.
      continueUnreadWorkerMail(h.runtime, h.db, dispatchId)
      throw new Error('prompt lost')
    })

    continueAllUnreadWorkerMail(h.runtime, h.db)

    await vi.waitFor(() => expect(getFollowUpDispatch(h.db, dispatchId)).toBeDefined())
    const failed = getFollowUpDispatch(h.db, dispatchId)!.id
    await vi.waitFor(() =>
      expect(h.db.getUnreadMessages(`dispatch:${failed}`)).toMatchObject([{ body: 'DO NOT PUSH' }])
    )
  })

  async function blockFollowUp(): Promise<{ original: string; failed: string }> {
    const { taskId, dispatchId } = await h.startWorker()
    await send(dispatchId, 'DO NOT PUSH')
    h.settle(taskId, dispatchId, 'succeeded')
    vi.mocked(h.runtime.waitForTerminal).mockResolvedValueOnce({
      handle: 'term_worker',
      condition: 'tui-idle',
      satisfied: false,
      status: 'running',
      exitCode: null,
      blockedReason: 'agent-trust-workspace'
    })
    await continueUnreadWorkerMail(h.runtime, h.db, dispatchId)
    await vi.waitFor(() =>
      expect(h.db.getWorkerDispatch(getFollowUpDispatch(h.db, dispatchId)?.id ?? '')).toMatchObject(
        {
          state: 'failed',
          stage: 'agent_readiness'
        }
      )
    )
    return { original: dispatchId, failed: getFollowUpDispatch(h.db, dispatchId)!.id }
  }

  it('keeps blocked-start mail across relaunches without waking the lead, until an explicit send', async () => {
    userDataDir = mkdtempSync(join(tmpdir(), 'orca-follow-up-blocked-'))
    h.setup({ userDataDir })
    const { original, failed } = await blockFollowUp()
    const mail = h.db.getUnreadMessages(`dispatch:${failed}`)
    expect(mail).toMatchObject([{ body: 'DO NOT PUSH' }])
    const notices = h.db.getUnreadMessages(`run:${h.activeRunId}`, ['escalation'])
    expect(notices).not.toHaveLength(0)

    for (let relaunch = 0; relaunch < 2; relaunch++) {
      h.restart()
      await continueUnreadWorkerMail(h.runtime, h.db, failed)
      expect(getFollowUpDispatch(h.db, failed)).toBeUndefined()
      expect(h.db.getUnreadMessages(`dispatch:${failed}`)).toEqual(mail)
      expect(h.db.getUnreadMessages(`run:${h.activeRunId}`, ['escalation'])).toEqual(notices)
    }

    await send(original, 'and the docs')
    const next = getFollowUpDispatch(h.db, failed)!
    expect(h.db.getWorkerDispatch(next.id)?.state).toBe('ready')
    expect(h.db.getUnreadMessages(`dispatch:${next.id}`)).toMatchObject([{ body: 'DO NOT PUSH' }])
  })

  it('does not retry a blocked descendant through an older marked mailbox', async () => {
    h.setup()
    const { original, failed } = await blockFollowUp()
    h.db.insertMessage({
      runId: h.activeRunId,
      from: 'term_coord',
      to: `dispatch:${original}`,
      subject: 'More',
      body: 'KEEP THE DOCS',
      type: 'status'
    })
    markUnreadFollowUpMail(h.db, original)

    await continueUnreadWorkerMail(h.runtime, h.db, original)

    expect(getFollowUpDispatch(h.db, failed)).toBeUndefined()
    expect(h.db.getUnreadMessages(`dispatch:${original}`)).toMatchObject([
      { body: 'KEEP THE DOCS' }
    ])
    expect(h.db.getUnreadMessages(`dispatch:${failed}`)).toMatchObject([{ body: 'DO NOT PUSH' }])
  })

  it('still continues genuinely new mail after a worker reports a failed task', async () => {
    h.setup()
    const { taskId, dispatchId } = await h.startWorker()
    await send(dispatchId, 'TRY THE OTHER APPROACH')
    h.settle(taskId, dispatchId, 'failed')

    await continueUnreadWorkerMail(h.runtime, h.db, dispatchId)

    await vi.waitFor(() =>
      expect(h.db.getWorkerDispatch(getFollowUpDispatch(h.db, dispatchId)?.id ?? '')?.state).toBe(
        'ready'
      )
    )
    const next = getFollowUpDispatch(h.db, dispatchId)!
    expect(h.db.getUnreadMessages(`dispatch:${next.id}`)).toMatchObject([
      { body: 'TRY THE OTHER APPROACH' }
    ])
  })

  it('lists the finished worker without the terminal its follow-up took over', async () => {
    h.setup()
    const { dispatchId } = await h.startSettledWorker()
    await send(dispatchId, 'and the docs')
    const followUpId = getFollowUpDispatch(h.db, dispatchId)!.id
    expect(h.db.getWorkerTerminalResourceByOwner(followUpId)?.terminal_handle).toBe('term_worker')

    await expect(h.call('orchestration.workerList', { run: h.activeRunId })).resolves.toMatchObject(
      {
        workers: expect.arrayContaining([
          expect.objectContaining({
            dispatchId,
            agentTerminalHandle: null,
            terminalState: null,
            projection: expect.objectContaining({
              // Nothing proves the original's process ended, so liveness stays unverifiable.
              liveness: { verdict: 'unverifiable', reason: 'missing_status' },
              nextAction: expect.objectContaining({ kind: 'none' })
            })
          }),
          expect.objectContaining({
            dispatchId: followUpId,
            agentTerminalHandle: 'term_worker',
            terminalState: 'active'
          })
        ]),
        counts: { active: 1 }
      }
    )

    // A -> B -> C, then C's release: neither earlier row claims the terminal.
    const b = getFollowUpDispatch(h.db, dispatchId)!
    h.settle(b.task_id, b.id, 'succeeded')
    await send(b.id, 'and the tests')
    const c = getFollowUpDispatch(h.db, b.id)!
    h.settle(c.task_id, c.id, 'succeeded')
    await expect(h.call('orchestration.workerRelease', { dispatch: c.id })).resolves.toMatchObject({
      state: 'released'
    })
    const handedOn = (id: string) =>
      expect.objectContaining({ dispatchId: id, agentTerminalHandle: null, terminalState: null })
    await expect(h.call('orchestration.workerList', { run: h.activeRunId })).resolves.toMatchObject(
      {
        workers: [
          expect.objectContaining({
            dispatchId: c.id,
            agentTerminalHandle: 'term_worker',
            terminalState: 'released'
          }),
          handedOn(b.id),
          handedOn(dispatchId)
        ],
        counts: { released: 1 }
      }
    )
    await expect(
      h.call('orchestration.workerList', { run: h.activeRunId, terminalState: 'retained' })
    ).resolves.toMatchObject({ workers: [] })
  })
})
