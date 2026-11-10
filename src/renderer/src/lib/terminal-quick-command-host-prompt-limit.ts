import { TERMINAL_QUICK_COMMAND_LAUNCH_OPTIONS_RUNTIME_CAPABILITY } from '../../../shared/terminal/quick-commands/terminal-quick-command-capabilities'
import type { AppState } from '@/store/types'
import { terminalQuickCommandAgentPromptMaxLength } from '../../../shared/terminal/quick-commands/terminal-quick-command-prompt-limit'
import { parseExecutionHostId, type ExecutionHostId } from '../../../shared/execution-host'
import { lastVerifiedRuntimeStatus } from '../../../shared/remote-runtime/host-status/runtime-host-status'

/** An older host's agent-prompt character cap, read from its live status; `null` for none. */
export function getTerminalQuickCommandHostPromptMaxLength(
  state: Pick<AppState, 'runtimeStatusByEnvironmentId'>,
  hostId: ExecutionHostId
): number | null {
  const parsed = parseExecutionHostId(hostId)
  if (!parsed || parsed.kind !== 'runtime') {
    return null
  }
  return terminalQuickCommandAgentPromptMaxLength(
    lastVerifiedRuntimeStatus(state.runtimeStatusByEnvironmentId.get(parsed.environmentId))
      ?.capabilities
  )
}

export function getTerminalQuickCommandHostLaunchOptionsSupported(
  state: Pick<AppState, 'runtimeStatusByEnvironmentId'>,
  hostId: ExecutionHostId
): boolean {
  const parsed = parseExecutionHostId(hostId)
  if (!parsed || parsed.kind !== 'runtime') {
    return true
  }
  return (
    lastVerifiedRuntimeStatus(
      state.runtimeStatusByEnvironmentId.get(parsed.environmentId)
    )?.capabilities?.includes(TERMINAL_QUICK_COMMAND_LAUNCH_OPTIONS_RUNTIME_CAPABILITY) === true
  )
}
