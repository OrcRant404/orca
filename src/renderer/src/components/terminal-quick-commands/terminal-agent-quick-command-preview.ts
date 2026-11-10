import type { TerminalAgentQuickCommand } from '../../../../shared/terminal/quick-commands/terminal-quick-command-types'
import { getAgentLabel } from '@/lib/agent-catalog'

/** One-line list preview, e.g. `Codex · gpt-5.5: Review this diff`. */
export function formatTerminalAgentQuickCommandPreview(command: TerminalAgentQuickCommand): string {
  const model = command.launchOptions?.model
  const target = model ? `${getAgentLabel(command.agent)} · ${model}` : getAgentLabel(command.agent)
  return command.prompt ? `${target}: ${command.prompt}` : target
}
