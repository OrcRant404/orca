import { expect, it } from 'vitest'

import {
  emptyCrew,
  type OrchestrationCrewSnapshot
} from '../../../../shared/orchestration/orchestration-crew'

import { CrewReadModel } from './crew-read-model'
import { fixture } from './crew-read-model.test-fixture'
import { subscribeCrew } from './crew-stream'
import { agentSessionRecordFixture } from '../../../native-chat/agent-session-record-test-fixture'
import { agentSessionConversationView } from '../../../../shared/agent-session/lifecycle/agent-session-conversation-view'
import { testOrcaSessionId } from '../../../../shared/orca-session-address-test-fixture'
import { formatOrcaSessionAddress } from '../../../../shared/orca-session-address'

const flush = async () => {
  await Promise.resolve()
  await Promise.resolve()
}

function mounted(model: CrewReadModel, addresses: string[]) {
  const snapshots = new Map<string, OrchestrationCrewSnapshot>()
  const stops = addresses.map((address) => {
    let pending = emptyCrew('unknown')
    return subscribeCrew(
      () => model.read(address),
      model.subscribe,
      (frame) => {
        if (frame.type === 'begin') {
          pending = emptyCrew(frame.status)
        } else if (frame.type === 'rows') {
          pending.sections[frame.section].push(...frame.rows)
        } else if (frame.type === 'complete') {
          snapshots.set(address, pending)
        }
      }
    )
  })
  return {
    stop: () => stops.forEach((stop) => stop()),
    rows: (address: string) => Object.values(snapshots.get(address)!.sections).flat()
  }
}

it('invalidates the current coordinator alias using returned persisted routing endpoints', async () => {
  const f = fixture()
  f.db.bindRun({
    runId: f.run.id,
    coordinatorHandle: 'term_helper',
    coordinatorPaneKey: f.handles.get('term_helper')!
  })
  const model = new CrewReadModel(() => f.deps, f.db.crewChanges.subscribe)
  const stream = mounted(model, ['term_helper'])
  try {
    const message = f.db.insertMessage({
      runId: f.run.id,
      from: 'term_peer',
      to: 'term_coord',
      subject: 'Remembered coordinator',
      body: 'Delivered to the current coordinator'
    })
    expect(message.to_handle).toBe(`run:${f.run.id}`)
    await flush()
    expect(stream.rows('term_helper').some((row) => row.latest?.preview === message.body)).toBe(
      true
    )
  } finally {
    stream.stop()
  }
})

it('removes a closed native worker from a mounted team and restores its retained assignment on reopen', async () => {
  const f = fixture()
  const root = testOrcaSessionId('closed-worker-root')
  const current = testOrcaSessionId('closed-worker-current')
  const records = [
    agentSessionConversationView(
      agentSessionRecordFixture({
        sessionId: root,
        conversationCommand: {
          command: 'clear',
          state: 'completed',
          callerKey: 'crew-close',
          phase: 'committed',
          replacementSessionId: current,
          operationId: 'crew-close-clear'
        }
      })
    ),
    agentSessionConversationView(agentSessionRecordFixture({ sessionId: current }))
  ]
  const visible = new Set<string>([current])
  f.deps.records = {
    listRecords: () => records,
    getRecord: (id) => records.find((record) => record.sessionId === id) ?? null,
    getVisibleSessionTabIndex: () => ({ present: true, sessionIds: [...visible] }),
    isSessionTabRetired: (id) => !visible.has(id)
  }
  const address = formatOrcaSessionAddress(root)
  const worker = f.assign(address, 'term_coord', 'Native worker')
  f.assign('term_helper', 'term_coord', 'Open worker')
  f.db.insertMessage({
    from: address,
    to: 'term_coord',
    subject: 'Update',
    body: 'Retained worker update'
  })
  const model = new CrewReadModel(() => f.deps, f.db.crewChanges.subscribe)
  const stream = mounted(model, ['term_coord'])
  try {
    expect(
      stream
        .rows('term_coord')
        .map((row) => row.task?.title)
        .sort()
    ).toEqual(['Native worker', 'Open worker'])
    expect(
      stream.rows('term_coord').find((row) => row.task?.title === 'Native worker')?.openTarget
    ).toMatchObject({ kind: 'chat', sessionId: current })
    visible.clear()
    f.db.crewChanges.notify(new Set(['records']))
    await flush()
    expect(stream.rows('term_coord').map((row) => row.task?.title)).toEqual(['Open worker'])
    expect(f.db.getDispatchContextById(worker.id)?.assignee_orca_session_id).toBe(root)
    visible.add(current)
    f.db.crewChanges.notify(new Set(['records']))
    await flush()
    expect(
      stream
        .rows('term_coord')
        .map((row) => row.task?.title)
        .sort()
    ).toEqual(['Native worker', 'Open worker'])
  } finally {
    stream.stop()
  }
})
