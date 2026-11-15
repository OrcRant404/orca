import type { OrcaRuntimeService } from '../../../orca-runtime'
import type { RuntimeMobileSessionTabsResult } from '../../../../../shared/runtime-session-contracts'

/** Forwarded writes are acknowledged before the owning window publishes their effect. */
export async function unhideSessionTabForActivation(
  runtime: OrcaRuntimeService,
  inventory: RuntimeMobileSessionTabsResult,
  tabId: string
): Promise<void> {
  let unsubscribe = (): void => {}
  let timeout: ReturnType<typeof setTimeout> | undefined
  let applied = false
  let fail: (error: Error) => void = () => {}
  const confirmation = new Promise<void>((resolve, reject) => {
    fail = reject
    unsubscribe = runtime.onMobileSessionTabsChanged((snapshot) => {
      if (
        snapshot.worktree === inventory.worktree &&
        snapshot.tabs.some((tab) => tab.id === tabId && tab.isHidden !== true)
      ) {
        applied = true
        resolve()
      }
    })
    timeout = setTimeout(() => reject(new Error('tab_visibility_confirmation_timeout')), 15_000)
  })
  // A failed write can reject before anyone awaits its confirmation.
  void confirmation.catch(() => {})
  try {
    const reply = await runtime.setMobileSessionTabProps(`id:${inventory.worktree}`, {
      tabId,
      isHidden: false
    })
    if (reply.forwarded && !applied) {
      await confirmation
    }
  } catch (error) {
    fail(error instanceof Error ? error : new Error(String(error)))
    throw error
  } finally {
    if (timeout !== undefined) {
      clearTimeout(timeout)
    }
    unsubscribe()
  }
}
