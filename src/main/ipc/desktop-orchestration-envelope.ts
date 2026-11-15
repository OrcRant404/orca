import { randomUUID } from 'node:crypto'
import { isOrchestrationMutation } from '../../shared/orchestration/orchestration-rpc-contract'
import { ORCHESTRATION_CONTRACT_VERSION } from '../../shared/orchestration/orchestration-runtime-capabilities'
import type { RuntimeOrchestrationEnvelope } from '../../shared/runtime-rpc-envelope'

/** The trusted desktop speaks this build's contract; retain one identity across transport retries. */
export function desktopOrchestrationEnvelope(
  method: string,
  params: unknown
): RuntimeOrchestrationEnvelope | undefined {
  return isOrchestrationMutation(method, params)
    ? {
        orchestrationContractVersion: ORCHESTRATION_CONTRACT_VERSION,
        orchestrationRequestId: randomUUID()
      }
    : undefined
}
