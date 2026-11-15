import { callRuntimeRpc } from '@/runtime/rpc/calls/runtime-rpc-call'
import type { RuntimeClientTarget } from '../../../../shared/runtime-client-target'
import type { OrchestrationCrewRow } from '../../../../shared/orchestration/orchestration-crew'
import type { OrchestrationWorkerReadResult } from '../../../../shared/orchestration/workers/orchestration-worker-output'

export type CrewWorkerMail = {
  id: string
  subject: string
  body: string
  from_handle: string
  to_handle: string
  created_at: string
}
export type CrewWorkerMessages = {
  output: string | null
  source: string | null
  unavailable: string | null
  messages: CrewWorkerMail[]
  mailError: string | null
}
export async function readCrewWorkerMessages(
  target: RuntimeClientTarget,
  row: Pick<
    OrchestrationCrewRow,
    'dispatchId' | 'coordinatorAddress' | 'workerAddress' | 'openTarget'
  >,
  signal?: AbortSignal
): Promise<CrewWorkerMessages> {
  const dispatchId = row.dispatchId!
  const workerAddresses = new Set([
    `dispatch:${dispatchId}`,
    row.workerAddress,
    row.openTarget?.kind === 'chat'
      ? `orca_session_id:${row.openTarget.sessionId}`
      : row.openTarget?.kind === 'terminal'
        ? row.openTarget.handle
        : undefined
  ])
  const [output, mail, replies] = await Promise.allSettled([
    callRuntimeRpc<OrchestrationWorkerReadResult>(
      target,
      'orchestration.workerRead',
      { dispatch: dispatchId, limit: 50000 },
      { signal }
    ),
    callRuntimeRpc<{ messages: CrewWorkerMail[] }>(
      target,
      'orchestration.inbox',
      { terminal: `dispatch:${dispatchId}`, limit: 100 },
      { signal }
    ),
    row.coordinatorAddress
      ? callRuntimeRpc<{ messages: CrewWorkerMail[] }>(
          target,
          'orchestration.inbox',
          { terminal: row.coordinatorAddress, limit: 100 },
          { signal }
        )
      : Promise.resolve({ messages: [] as CrewWorkerMail[] })
  ])
  let text: string | null = null
  let source: string | null = null
  let unavailable: string | null = null
  if (output.status === 'fulfilled') {
    const result = output.value
    source = result.archived
      ? 'Saved worker output'
      : result.source === 'transcript'
        ? 'Agent transcript'
        : 'Terminal output'
    text =
      result.source === 'terminal'
        ? result.terminal.tail.join('\n')
        : result.transcript.messages
            .map(
              (message) =>
                `${message.role}\n${message.blocks.flatMap((block) => (block.type === 'text' ? [block.text] : [])).join('\n')}`
            )
            .join('\n\n')
  } else {
    unavailable = output.reason instanceof Error ? output.reason.message : String(output.reason)
  }
  const messages = new Map(
    (mail.status === 'fulfilled' ? mail.value.messages : []).map((message) => [message.id, message])
  )
  if (replies.status === 'fulfilled') {
    for (const message of replies.value.messages) {
      if (workerAddresses.has(message.from_handle)) {
        messages.set(message.id, message)
      }
    }
  }
  return {
    output: text,
    source,
    unavailable,
    messages: [...messages.values()].sort((a, b) => a.created_at.localeCompare(b.created_at)),
    mailError: mail.status === 'rejected' ? String(mail.reason) : null
  }
}
