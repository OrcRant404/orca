import {
  findCatalogModel,
  findCatalogOption,
  getAgentSessionOptionCatalog
} from '../../../../shared/agent-session/options/agent-session-option-catalog'
import type { SessionOptionSelectChoice } from '../../../../shared/native-chat/input/native-chat-session-options'
import type { TerminalQuickCommandLaunchOptions } from '../../../../shared/terminal/quick-commands/terminal-quick-command-types'
import type { TuiAgent } from '../../../../shared/agent-launch/catalog/tui-agent'

export const QUICK_COMMAND_LAUNCH_MODEL_MAX_LENGTH = 256
export const QUICK_COMMAND_LAUNCH_OPTION_MAX_LENGTH = 64
// Why: Codex's priority service tier is what its UI calls Fast.
export const QUICK_COMMAND_FAST_SERVICE_TIER = 'priority'

export function supportsTerminalQuickCommandFastMode(agent: TuiAgent): boolean {
  return agent === 'codex'
}

export function getTerminalQuickCommandEffortChoices(
  agent: TuiAgent,
  model: string
): SessionOptionSelectChoice[] {
  const catalog = getAgentSessionOptionCatalog(agent)
  if (!catalog) {
    return []
  }
  const option =
    findCatalogOption(findCatalogModel(catalog, model), 'effort') ??
    catalog.unknownModelOptions?.find((candidate) => candidate.id === 'effort')
  return option?.kind.type === 'select' ? option.kind.choices : []
}

/** Trimmed options for save; a blank model drops effort and speed, which depend on it. */
export function finalizeTerminalQuickCommandLaunchOptions(
  options: TerminalQuickCommandLaunchOptions | undefined
): TerminalQuickCommandLaunchOptions | undefined {
  const model = options?.model.trim().slice(0, QUICK_COMMAND_LAUNCH_MODEL_MAX_LENGTH)
  if (!options || !model) {
    return undefined
  }
  const effort = options.effort?.trim().slice(0, QUICK_COMMAND_LAUNCH_OPTION_MAX_LENGTH)
  const serviceTier = options.serviceTier?.trim().slice(0, QUICK_COMMAND_LAUNCH_OPTION_MAX_LENGTH)
  return {
    model,
    ...(effort ? { effort } : {}),
    ...(serviceTier ? { serviceTier } : {})
  }
}
