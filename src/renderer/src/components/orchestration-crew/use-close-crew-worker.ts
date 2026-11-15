import { useContext, useState } from 'react'
import { toast } from 'sonner'
import { ConfirmationDialogContext } from '@/components/confirmation-dialog-context'
import { callRuntimeRpc } from '@/runtime/rpc/calls/runtime-rpc-call'
import { useTranslate } from '@/i18n/use-translate'
import type { OrchestrationCrewRow } from '../../../../shared/orchestration/orchestration-crew'
import type { RuntimeClientTarget } from '../../../../shared/runtime-client-target'
import type { RuntimeTerminalClose } from '../../../../shared/runtime-terminal-contracts'
import type { WorkerStopReceipt } from '../../../../shared/orchestration/workers/orchestration-worker-stop-receipt'

type Call = <T>(method: string, params: unknown) => Promise<T>
export async function closeCrewWorker(row: OrchestrationCrewRow, call: Call): Promise<void> {
  if (!row.dispatchId || row.role !== 'worker' || !row.openTarget) {
    throw new Error('This row has no worker session to close.')
  }
  if (row.openTarget.kind === 'chat' && row.ownership !== 'owned') {
    await call('agentSession.close', { sessionId: row.openTarget.sessionId })
    return
  }
  const shown = await call<{
    observation?: { exactWorker?: boolean; status?: string }
    worker?: { state?: string }
    terminalResource?: { ownershipState?: string }
  }>('orchestration.workerShow', { dispatch: row.dispatchId })
  if (shown.observation?.exactWorker !== true) {
    throw new Error('The host cannot verify this worker. Refresh Team before closing it.')
  }
  if (row.ownership === 'owned' && row.openTarget.kind !== 'dispatch') {
    await call('orchestration.workerKeepOpen', {
      ...(row.openTarget.kind === 'chat'
        ? { sessionId: row.openTarget.sessionId }
        : { terminal: row.openTarget.handle }),
      keep: false
    })
  }
  if (row.ownership === 'owned' && !row.retained) {
    const receipt = await call<WorkerStopReceipt>('orchestration.workerStop', {
      dispatch: row.dispatchId
    })
    if (
      receipt.state !== 'stopped' ||
      receipt.helperStopError ||
      receipt.helpers?.some((helper) => ['unconfirmed', 'starting'].includes(helper.outcome))
    ) {
      throw new Error(
        receipt.lastError ??
          receipt.helperStopError ??
          'The host could not confirm that the worker stopped.'
      )
    }
    await call('orchestration.workerRelease', { dispatch: row.dispatchId })
    return
  }
  // Explicit user cleanup of an adopted chat uses the same close as its tab, preserving history.
  if (row.openTarget.kind === 'chat') {
    await call('agentSession.close', { sessionId: row.openTarget.sessionId })
  } else if (row.openTarget.kind === 'terminal') {
    const result = await call<{ close: RuntimeTerminalClose }>('terminal.close', {
      terminal: row.openTarget.handle
    })
    if (!result.close.ptyKilled && shown.observation.status !== 'exited') {
      throw new Error('The terminal did not close. Refresh Team before retrying.')
    }
    await call('orchestration.workerRelease', { dispatch: row.dispatchId })
  } else {
    throw new Error('Open this worker on its execution host to close it.')
  }
}

export function useCloseCrewWorker(row: OrchestrationCrewRow, target: RuntimeClientTarget) {
  const t = useTranslate()
  const confirm = useContext(ConfirmationDialogContext)
  const [closing, setClosing] = useState(false)
  return {
    closing,
    close: async () => {
      if (closing || !confirm) {
        return
      }
      const accepted = await confirm({
        title: t('components.orchestrationCrew.stopTitle', 'Stop and close {{name}}?', {
          name: row.label
        }),
        description: t(
          'components.orchestrationCrew.stopDescription',
          'This interrupts any ongoing work and removes this worker from the team. Saved chat history remains available.'
        ),
        confirmLabel: t('components.orchestrationCrew.stopConfirm', 'Stop and close'),
        confirmVariant: 'destructive'
      })
      if (!accepted) {
        return
      }
      setClosing(true)
      try {
        await closeCrewWorker(row, (method, params) => callRuntimeRpc(target, method, params))
        toast.success(
          t('components.orchestrationCrew.workerClosed', 'Closed {{name}}', { name: row.label })
        )
      } catch (error) {
        toast.error(error instanceof Error ? error.message : String(error))
      } finally {
        setClosing(false)
      }
    }
  }
}
