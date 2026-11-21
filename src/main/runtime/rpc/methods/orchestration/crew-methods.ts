import { CrewSubscribeParams } from '../../../../../shared/orchestration/orchestration-crew'
import { subscribeCrew } from '../../../orchestration/crew/crew-stream'
import { defineMethod, defineStreamingMethod } from '../../core'

let sequence = 0
export const ORCHESTRATION_CREW_METHODS = [
  defineMethod({
    name: 'orchestration.crewSnapshot',
    permission: 'workspace',
    params: CrewSubscribeParams,
    handler: async ({ party }, { runtime }) => {
      await runtime.openAgentSessionRecordStore()
      return runtime.getOrchestrationCrewSnapshot(party)
    }
  }),
  defineStreamingMethod({
    name: 'orchestration.crewSubscribe',
    permission: 'workspace',
    params: CrewSubscribeParams,
    handler: async ({ party }, { runtime, signal, connectionId }, emit) => {
      if (signal?.aborted) {
        return
      }
      await runtime.openAgentSessionRecordStore()
      if (signal?.aborted) {
        return
      }
      await new Promise<void>((resolve) => {
        const key = `crew:${connectionId ?? 'local'}:${++sequence}`
        const release = () => runtime.cleanupSubscription(key)
        const stop = subscribeCrew(
          () => runtime.getOrchestrationCrewSnapshot(party),
          runtime.watchOrchestrationCrew,
          emit,
          250
        )
        runtime.registerSubscriptionCleanup(
          key,
          () => {
            stop()
            signal?.removeEventListener('abort', release)
            emit({ type: 'end' })
            resolve()
          },
          connectionId
        )
        signal?.addEventListener('abort', release, { once: true })
        if (signal?.aborted) {
          release()
        }
      })
    }
  })
]
