import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect, it } from 'vitest'
import { agentSessionRecordFixture } from '../../agent-session-record-test-fixture'
import type { AgentJournalSnapshot } from '../../../../shared/agent-session/journal/agent-session-journal-types'
import type {
  StructuredAgentSessionHostDeps,
  StructuredAgentSessionHostSession
} from '../host/structured-agent-session-host-types'
import { continuationContextReader } from './structured-agent-session-continuation-context'

it('forks through the selected turn without exposing later prompts, including a late member of that turn', async () => {
  const stateDirectory = await mkdtemp(join(tmpdir(), 'orca-turn-fork-'))
  const record = agentSessionRecordFixture({ sessionId: 'source', provider: 'grok' })
  const snapshot: AgentJournalSnapshot = {
    sessionId: 'source',
    cursor: { epoch: 'epoch', sequence: 7 },
    submissions: [],
    items: [
      {
        itemId: 'u1',
        body: { kind: 'message', role: 'user', blocks: [{ type: 'text', text: 'FIRST_REQUEST' }] }
      },
      { itemId: 't1', body: { kind: 'turn', turnId: 't1', userItemId: 'u1', state: 'completed' } },
      {
        itemId: 'a1',
        turnScope: { kind: 'turn', turnItemId: 't1' },
        body: {
          kind: 'message',
          role: 'assistant',
          blocks: [{ type: 'text', text: 'FIRST_ANSWER' }]
        }
      },
      {
        itemId: 'u2',
        turnScope: { kind: 'turn', turnItemId: 't2' },
        body: {
          kind: 'message',
          role: 'user',
          blocks: [{ type: 'text', text: 'LATER_PRIVATE_REQUEST' }]
        }
      },
      { itemId: 't2', body: { kind: 'turn', turnId: 't2', userItemId: 'u2', state: 'completed' } },
      {
        itemId: 'a2',
        turnScope: { kind: 'turn', turnItemId: 't2' },
        body: {
          kind: 'message',
          role: 'assistant',
          blocks: [{ type: 'text', text: 'LATER_PRIVATE_ANSWER' }]
        }
      },
      {
        itemId: 'late',
        turnScope: { kind: 'turn', turnItemId: 't1' },
        body: {
          kind: 'message',
          role: 'assistant',
          blocks: [{ type: 'text', text: 'LATE_FIRST_TURN_DETAIL' }]
        }
      }
    ].map((item, index) => ({
      ...item,
      sequence: index + 1,
      revision: 0,
      observedAt: 1
    })) as AgentJournalSnapshot['items']
  }
  const before = JSON.stringify(snapshot)
  const read = continuationContextReader(
    {
      store: { getConversation: () => record, getRecord: () => record },
      journalDatabase: { stateDirectory }
    } as unknown as StructuredAgentSessionHostDeps,
    async () => ({ journal: { snapshot: () => snapshot } }) as StructuredAgentSessionHostSession
  )
  const input = {
    sessionId: 'source',
    workspaceId: record.location.workspaceId,
    expectedCursor: { epoch: 'epoch', sequence: 0 },
    throughItemId: 'a1'
  }
  try {
    const result = await read(input)
    expect(result.status).toBe('current')
    if (result.status !== 'current' || !result.transcriptPath) {
      throw new Error('Missing fork snapshot')
    }
    const text = await readFile(result.transcriptPath, 'utf8')
    for (const value of [text, result.capturedText]) {
      expect(value).toContain('FIRST_REQUEST')
      expect(value).toContain('FIRST_ANSWER')
      expect(value).toContain('LATE_FIRST_TURN_DETAIL')
      expect(value).not.toContain('LATER_PRIVATE')
    }
    expect(JSON.stringify(snapshot)).toBe(before)
    expect(await read({ ...input, expectedCursor: { epoch: 'stale', sequence: 0 } })).toEqual({
      status: 'superseded'
    })
    expect(await read({ ...input, throughItemId: 'missing' })).toEqual({ status: 'superseded' })
    snapshot.items.splice(3)
    snapshot.items[1].body = { kind: 'turn', turnId: 't1', userItemId: 'u1', state: 'running' }
    expect(await read(input)).toEqual({ status: 'superseded' })
    snapshot.items.push({
      itemId: 'clear',
      sequence: 4,
      revision: 0,
      observedAt: 1,
      body: {
        kind: 'status',
        text: 'Cleared',
        contextClear: { operationId: 'clear', afterFence: 1, clearedAt: 1 }
      }
    })
    expect(await read(input)).toEqual({ status: 'superseded' })
  } finally {
    await rm(stateDirectory, { recursive: true, force: true })
  }
})
