import { expect, it } from 'vitest'
import { fixture } from './crew-read-model.test-fixture'
import { buildCrewSnapshot } from './crew-party-snapshot'
import { agentSessionRecordFixture } from '../../../native-chat/agent-session-record-test-fixture'
import { agentSessionConversationView } from '../../../../shared/agent-session/lifecycle/agent-session-conversation-view'

it('keeps an old completed native worker while its chat is retained and removes it after user cleanup', () => {
  const { db, deps, assign } = fixture()
  const record = agentSessionConversationView(
    agentSessionRecordFixture({ sessionId: 'chat-retained' })
  )
  let open = true
  deps.records = {
    getRecord: (id) => (id === record.sessionId ? record : null),
    listRecords: () => [record],
    listVisibleSessionIds: () => (open ? ['chat-retained'] : []),
    isSessionTabRetired: () => !open
  }
  deps.name = (party) => (party.orcaSessionId === 'chat-retained' ? 'Retained review' : 'Lead')
  const dispatch = assign('orca_session_id:chat-retained', 'term_coord', 'A different task title')
  db.completeDispatch(dispatch.id)
  db.db
    .prepare("UPDATE dispatch_contexts SET completed_at = '2000-01-01' WHERE id = ?")
    .run(dispatch.id)
  const worker = buildCrewSnapshot('term_coord', deps).sections.managing
  expect(worker).toMatchObject([
    {
      label: 'Retained review',
      dispatchId: dispatch.id,
      retained: true,
      task: { title: 'A different task title' }
    }
  ])
  open = false
  expect(buildCrewSnapshot('term_coord', deps).sections.managing).toEqual([])
})

it('keeps retained CLI workers across age and restart, excludes released resources, and isolates their lead', () => {
  const { db, deps, assign, handles } = fixture()
  const dispatch = assign('term_worker')
  const other = assign('term_helper', 'term_peer')
  for (const [id, handle] of [
    [dispatch.id, 'term_worker'],
    [other.id, 'term_helper']
  ]) {
    db.completeDispatch(id)
    const resource = db.createWorkerTerminalResourceStatement({
      dispatchId: id,
      worktreeId: 'workspace-1',
      terminalHandle: handle,
      paneKey: handles.get(handle)!,
      processIncarnation: `process:${handle}`,
      ownership: 'owned'
    })
    db.db
      .prepare("UPDATE worker_terminal_resources SET release_state = 'retained' WHERE id = ?")
      .run(resource.id)
    db.db.prepare("UPDATE dispatch_contexts SET completed_at = '2000-01-01' WHERE id = ?").run(id)
  }
  expect(
    buildCrewSnapshot('term_coord', deps).sections.managing.map((row) => row.dispatchId)
  ).toEqual([dispatch.id])
  expect(
    buildCrewSnapshot('term_peer', deps).sections.managing.map((row) => row.dispatchId)
  ).toEqual([other.id])
  db.db
    .prepare(
      "UPDATE worker_terminal_resources SET release_state = 'released' WHERE owner_dispatch_id = ?"
    )
    .run(dispatch.id)
  expect(buildCrewSnapshot('term_coord', deps).sections.managing).toEqual([])
  expect(
    buildCrewSnapshot('term_peer', deps).sections.managing.map((row) => row.dispatchId)
  ).toEqual([other.id])
})

it('does not resurrect an older retained assignment after the same worker was cleaned up on a newer assignment', () => {
  const { db, deps, assign, handles } = fixture()
  const first = assign('term_worker')
  db.completeDispatch(first.id)
  const resource = db.createWorkerTerminalResourceStatement({
    dispatchId: first.id,
    worktreeId: 'workspace-1',
    terminalHandle: 'term_worker',
    paneKey: handles.get('term_worker')!,
    processIncarnation: 'process:term_worker',
    ownership: 'owned'
  })
  db.db
    .prepare("UPDATE worker_terminal_resources SET release_state = 'retained' WHERE id = ?")
    .run(resource.id)
  db.db
    .prepare("UPDATE dispatch_contexts SET completed_at = '2000-01-01' WHERE id = ?")
    .run(first.id)
  const second = assign('term_worker')
  db.completeDispatch(second.id)
  db.db
    .prepare("UPDATE dispatch_contexts SET completed_at = '2000-01-02' WHERE id = ?")
    .run(second.id)
  expect(buildCrewSnapshot('term_coord', deps).sections.managing).toEqual([])
})

it('does not count detached CLI history as a reusable worker after its pane has been cleaned up', () => {
  const { db, deps, assign, handles } = fixture()
  const dispatch = assign('term_worker')
  db.completeDispatch(dispatch.id)
  const resource = db.createWorkerTerminalResourceStatement({
    dispatchId: dispatch.id,
    worktreeId: 'workspace-1',
    terminalHandle: 'term_worker',
    paneKey: handles.get('term_worker')!,
    processIncarnation: 'process:term_worker',
    ownership: 'external'
  })
  db.db
    .prepare("UPDATE worker_terminal_resources SET release_state = 'retained' WHERE id = ?")
    .run(resource.id)
  handles.delete('term_worker')
  expect(buildCrewSnapshot('term_coord', deps).sections.managing).toEqual([])
})

it('keeps closed CLI identity and output history from reappearing as an open reusable worker', () => {
  const { db, deps, assign, handles } = fixture()
  const dispatch = assign('term_worker')
  db.completeDispatch(dispatch.id)
  const resource = db.createWorkerTerminalResourceStatement({
    dispatchId: dispatch.id,
    worktreeId: 'workspace-1',
    terminalHandle: 'term_worker',
    paneKey: handles.get('term_worker')!,
    processIncarnation: 'process:term_worker',
    ownership: 'external'
  })
  db.db
    .prepare("UPDATE worker_terminal_resources SET release_state = 'retained' WHERE id = ?")
    .run(resource.id)
  // Closing keeps the handle, old pane key and incarnation readable, while detaching its live pane.
  const livePane = deps.livePaneForHandle!
  deps.livePaneForHandle = (handle) => (handle === 'term_worker' ? null : livePane(handle))
  expect(deps.liveHandle('term_worker')).toBe(true)
  expect(buildCrewSnapshot('term_coord', deps).sections.managing).toEqual([])
})
