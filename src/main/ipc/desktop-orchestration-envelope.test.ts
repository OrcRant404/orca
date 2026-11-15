import { expect, it } from 'vitest'
import { desktopOrchestrationEnvelope } from './desktop-orchestration-envelope'
import { orchestrationMigrationFence } from '../runtime/rpc/orchestration-contract-fence'

it('admits desktop stop and release through the same contract fence as CLI mutations', () => {
  const requests = ['orchestration.workerStop', 'orchestration.workerRelease'].map((method) => ({
    id: method,
    authToken: 'desktop-ipc',
    method,
    params: { dispatch: 'worker-a' },
    ...desktopOrchestrationEnvelope(method, { dispatch: 'worker-a' })
  }))
  for (const request of requests) {
    expect(orchestrationMigrationFence(request, { runtimeId: 'test-runtime' })).toBeUndefined()
    expect(request.orchestrationRequestId).toBeTruthy()
  }
  expect(requests[0].orchestrationRequestId).not.toBe(requests[1].orchestrationRequestId)
  expect(desktopOrchestrationEnvelope('orchestration.workerShow', {})).toBeUndefined()
})
